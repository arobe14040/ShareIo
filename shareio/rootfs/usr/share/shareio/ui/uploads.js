/*
 * ShareIo upload companion
 *
 * Watches the web app's uploads (it uses the tus resumable upload
 * protocol) and adds:
 *
 *  - A floating status card with files done, percent, speed and time left
 *  - Progress in the tab title, and a clear "all done" confirmation:
 *    toast, title, desktop notification and chime when in the background
 *  - Resume: unfinished uploads are remembered; after a reload a banner
 *    links back to the share, where picking the same files again
 *    continues where they stopped
 *  - Network recovery: pauses when the connection drops, resumes when it
 *    returns; a Retry button if a file fails
 *  - A warning before leaving the page mid-upload, and a screen wake lock
 *
 * It only listens to the app (ports and globals from sharry.js) and adds
 * its own elements, so the upload itself works the same without it.
 */
(function () {
  'use strict';

  var STORE_KEY = 'shareio-uploads';
  var MAX_AGE = 7 * 24 * 3600 * 1000;
  var prefix = (window.__ingress && window.__ingress.prefix) || '';
  var baseTitle = document.title || 'ShareIo';

  var batches = {};          // upload id -> batch state (this page)
  var wakeLock = null;
  var offline = false;
  var titleTimer = null;

  /* ---------- Small helpers ---------- */

  function fmtBytes(n) {
    if (!isFinite(n) || n < 0) return '';
    var u = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0;
    while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return (i === 0 ? n : n.toFixed(n < 10 ? 1 : 0)) + ' ' + u[i];
  }
  function fmtTime(s) {
    if (!isFinite(s) || s <= 0) return '';
    if (s < 60) return Math.ceil(s) + ' s';
    if (s < 3600) return Math.round(s / 60) + ' min';
    return (s / 3600).toFixed(1) + ' h';
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function toast(text, opts) {
    if (window.ShareIo && window.ShareIo.toast) return window.ShareIo.toast(text, opts);
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function save(all) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(all)); } catch (e) { /* storage full or blocked */ }
  }
  function sharePage(url) {
    var m = /\/api\/v2\/sec\/upload\/([^/]+)\/files\/tus/.exec(url || '');
    return m ? location.origin + prefix + '/app/upload/' + m[1] : null;
  }
  function active() {
    return Object.keys(batches).filter(function (id) { return !batches[id].finished; });
  }

  /* ---------- Persistence (for resume after reload) ---------- */

  function persist(b) {
    var all = load();
    all[b.key] = {
      url: b.url,
      page: b.page,
      startedAt: b.startedAt,
      files: b.files.map(function (f, i) {
        return { name: f.name, size: f.size, done: !!b.done[i] };
      })
    };
    save(all);
  }
  function forget(key) {
    var all = load();
    delete all[key];
    save(all);
  }
  // A new upload of the same files to the same share is a resume of an
  // older record; drop that record so it is not reported twice.
  function absorbOlder(b) {
    var all = load(), names = b.files.map(function (f) { return f.name + '|' + f.size; });
    Object.keys(all).forEach(function (k) {
      var r = all[k];
      if (k === b.key || r.url !== b.url) return;
      var left = r.files.filter(function (f) { return !f.done && names.indexOf(f.name + '|' + f.size) === -1; });
      if (!left.length) delete all[k];
      else r.files = r.files.filter(function (f) { return f.done || names.indexOf(f.name + '|' + f.size) === -1; });
    });
    save(all);
  }

  /* ---------- Status card ---------- */

  var card;
  function ensureCard() {
    if (card) return card;
    card = el('div', 'sio-upcard', '' +
      '<div class="sio-upcard-head"><span class="sio-upcard-title">Uploading</span>' +
      '<span class="sio-upcard-pct">0%</span></div>' +
      '<div class="sio-upcard-bar"><div></div></div>' +
      '<div class="sio-upcard-meta"></div>' +
      '<div class="sio-upcard-actions"></div>');
    card.setAttribute('role', 'status');
    card.setAttribute('aria-live', 'polite');
    document.documentElement.appendChild(card);
    return card;
  }
  function hideCard(delay) {
    if (!card) return;
    var c = card;
    setTimeout(function () { if (!active().length) c.classList.remove('is-visible'); }, delay || 0);
  }

  function totals() {
    var t = { total: 0, sent: 0, files: 0, done: 0, speed: 0, failed: 0 };
    active().concat(Object.keys(batches).filter(function (id) { return batches[id].finished; }))
      .forEach(function (id) {
        var b = batches[id];
        if (b.finished && !b.showFinished) return;
        b.files.forEach(function (f, i) {
          t.total += f.size;
          t.files++;
          if (b.done[i]) { t.sent += f.size; t.done++; }
          else t.sent += Math.min(b.sent[i] || 0, f.size);
          if (b.failed[i]) t.failed++;
        });
        t.speed += b.speed || 0;
      });
    return t;
  }

  function render() {
    var ids = active();
    var t = totals();
    if (!ids.length && !t.files) return;
    var c = ensureCard();
    var pct = t.total ? Math.floor(100 * t.sent / t.total) : 0;
    var failed = t.failed > 0;
    c.classList.add('is-visible');
    c.classList.toggle('is-failed', failed);
    c.classList.toggle('is-offline', offline);
    c.querySelector('.sio-upcard-title').textContent =
      offline ? 'Waiting for connection' : failed ? 'Upload interrupted' : 'Uploading';
    c.querySelector('.sio-upcard-pct').textContent = pct + '%';
    c.querySelector('.sio-upcard-bar > div').style.width = pct + '%';
    var left = t.speed > 0 ? (t.total - t.sent) / t.speed : NaN;
    var meta = t.done + ' of ' + t.files + ' file' + (t.files === 1 ? '' : 's') +
      ' · ' + fmtBytes(t.sent) + ' of ' + fmtBytes(t.total);
    if (!offline && !failed && t.speed > 0) {
      meta += ' · ' + fmtBytes(t.speed) + '/s';
      if (fmtTime(left)) meta += ' · ' + fmtTime(left) + ' left';
    }
    c.querySelector('.sio-upcard-meta').textContent = meta;

    var actions = c.querySelector('.sio-upcard-actions');
    actions.innerHTML = '';
    if (failed && !offline) {
      var retry = el('button', 'sio-btn sio-btn-primary', 'Retry');
      retry.type = 'button';
      retry.addEventListener('click', retryFailed);
      actions.appendChild(retry);
    }
    if (ids.length) {
      document.title = (offline ? '⏸ ' : pct + '% · ') + 'Uploading – ' + baseTitle;
    }
  }

  /* ---------- Upload events ---------- */

  function onSubmit(data) {
    if (!data || !data.files || !data.files.length) return;
    var files = Array.prototype.slice.call(data.files);
    var b = batches[data.id] = {
      id: data.id,
      key: data.id + '@' + Date.now(),
      url: data.url,
      page: sharePage(data.url),
      files: files,
      done: {},
      failed: {},
      sent: {},
      startedAt: Date.now(),
      lastBytes: 0,
      lastTime: Date.now(),
      speed: 0,
      finished: false,
      showFinished: false
    };
    absorbOlder(b);
    persist(b);
    askNotifyPermission();
    keepAwake(true);
    render();
  }

  function sentNow(b) {
    var s = 0;
    b.files.forEach(function (f, i) { s += b.done[i] ? f.size : Math.min(b.sent[i] || 0, f.size); });
    return s;
  }

  function onState(msg) {
    var b = msg && batches[msg.id];
    var p = msg && msg.progress;
    if (!b || !p) return;
    var i = msg.file;
    if (p.state === 'progress') {
      b.sent[i] = p.uploaded;
      delete b.failed[i];
      var now = Date.now(), dt = (now - b.lastTime) / 1000;
      if (dt >= 0.75) {
        var s = sentNow(b);
        var inst = Math.max(0, (s - b.lastBytes) / dt);
        b.speed = b.speed ? b.speed * 0.6 + inst * 0.4 : inst;
        b.lastBytes = s;
        b.lastTime = now;
      }
    } else if (p.state === 'complete') {
      b.done[i] = true;
      delete b.failed[i];
      persist(b);
      if (Object.keys(b.done).length >= b.files.length) finish(b);
    } else if (p.state === 'failed') {
      b.failed[i] = p.error || 'failed';
      b.speed = 0;
      if (!offline) {
        toast('Upload of “' + (b.files[i] && b.files[i].name) + '” failed', {
          icon: 'warn',
          action: { label: 'Retry', onClick: retryFailed },
          duration: 8000
        });
      }
    }
    render();
  }

  function finish(b) {
    b.finished = true;
    b.showFinished = true;
    b.speed = 0;
    forget(b.key);
    var n = b.files.length;
    var text = n === 1 ? '“' + b.files[0].name + '” uploaded' : 'All ' + n + ' files uploaded';
    if (!active().length) {
      keepAwake(false);
      render();
      var c = ensureCard();
      c.classList.add('is-done');
      c.querySelector('.sio-upcard-title').textContent = 'Upload complete';
      c.querySelector('.sio-upcard-actions').innerHTML = '';
      setTimeout(function () {
        if (!active().length) {
          c.classList.remove('is-done');
          Object.keys(batches).forEach(function (id) { if (batches[id].finished) batches[id].showFinished = false; });
          hideCard();
        }
      }, 5000);
      announceDone(text);
    } else {
      toast(text);
    }
  }

  function retryFailed() {
    Object.keys(batches).forEach(function (id) {
      var b = batches[id];
      if (!Object.keys(b.failed).length) return;
      b.failed = {};
      var up = window.sharry_uploads && window.sharry_uploads[id];
      if (up) {
        try { up.start(); } catch (e) { /* the app will report an error */ }
      }
    });
    render();
  }

  /* ---------- Completion: toast, title, notification, chime ---------- */

  function announceDone(text) {
    toast(text, { duration: 4000 });
    if (document.hidden) {
      flashTitle('✓ ' + text);
      notify('ShareIo', text);
      chime();
    } else {
      document.title = baseTitle;
    }
  }

  function flashTitle(text) {
    clearInterval(titleTimer);
    var on = true;
    document.title = text;
    titleTimer = setInterval(function () {
      document.title = on ? baseTitle : text;
      on = !on;
    }, 1200);
    var stop = function () {
      if (document.hidden) return;
      clearInterval(titleTimer);
      document.title = baseTitle;
      document.removeEventListener('visibilitychange', stop);
    };
    document.addEventListener('visibilitychange', stop);
  }

  function askNotifyPermission() {
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    try {
      var r = Notification.requestPermission();
      if (r && r.catch) r.catch(function () {});
    } catch (e) { /* older browsers */ }
  }

  function notify(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      var icon = (document.querySelector('link[rel="icon"][type="image/svg+xml"]') || {}).href;
      var n = new Notification(title, { body: body, icon: icon, tag: 'shareio-upload' });
      n.onclick = function () { window.focus(); n.close(); };
    } catch (e) { /* not allowed in this context */ }
  }

  function chime() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx(), t = ctx.currentTime;
      [880, 1318.5].forEach(function (f, k) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + k * 0.12);
        g.gain.exponentialRampToValueAtTime(0.12, t + k * 0.12 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + k * 0.12 + 0.35);
        o.connect(g).connect(ctx.destination);
        o.start(t + k * 0.12);
        o.stop(t + k * 0.12 + 0.4);
      });
      setTimeout(function () { ctx.close(); }, 1000);
    } catch (e) { /* audio not available */ }
  }

  /* ---------- Stability: wake lock, leave warning, network ---------- */

  function keepAwake(on) {
    if (!('wakeLock' in navigator)) return;
    if (on && !wakeLock) {
      navigator.wakeLock.request('screen').then(function (l) {
        wakeLock = l;
        l.addEventListener('release', function () { wakeLock = null; });
      }).catch(function () {});
    } else if (!on && wakeLock) {
      wakeLock.release().catch(function () {});
      wakeLock = null;
    }
  }
  document.addEventListener('visibilitychange', function () {
    // Browsers drop the wake lock when the tab is hidden; take it back.
    if (!document.hidden && active().length) keepAwake(true);
  });

  window.addEventListener('beforeunload', function (ev) {
    if (!active().length) return;
    ev.preventDefault();
    ev.returnValue = 'Uploads are still running.';
    return ev.returnValue;
  });

  function setOffline(off) {
    if (off === offline) return;
    offline = off;
    var ids = active();
    ids.forEach(function (id) {
      var up = window.sharry_uploads && window.sharry_uploads[id];
      if (!up) return;
      try {
        if (off) up.abort(false);
        else up.start();
      } catch (e) { /* the app will report an error */ }
      if (!off) batches[id].failed = {};
    });
    if (ids.length) {
      toast(off ? 'Connection lost – upload paused' : 'Back online – resuming upload',
        { icon: off ? 'warn' : 'check' });
    }
    render();
  }
  window.addEventListener('offline', function () { setOffline(true); });
  window.addEventListener('online', function () { setOffline(false); });

  /* ---------- Resume banner after reload ---------- */

  function showResumeBanner() {
    var all = load(), now = Date.now(), changed = false;
    var open = Object.keys(all).filter(function (k) {
      var r = all[k];
      var stale = !r || !r.files || now - (r.startedAt || 0) > MAX_AGE;
      var left = r && r.files ? r.files.filter(function (f) { return !f.done; }).length : 0;
      if (stale || !left) { delete all[k]; changed = true; return false; }
      return true;
    });
    if (changed) save(all);
    if (!open.length || document.querySelector('.sio-resume')) return;

    var r = all[open[0]];
    var left = r.files.filter(function (f) { return !f.done; });
    var bytes = left.reduce(function (s, f) { return s + f.size; }, 0);
    var names = left.slice(0, 3).map(function (f) { return f.name; }).join(', ') +
      (left.length > 3 ? ' and ' + (left.length - 3) + ' more' : '');

    var bar = el('div', 'sio-resume');
    bar.setAttribute('role', 'alert');
    bar.innerHTML = '<div class="sio-resume-text"><strong></strong><span></span></div><div class="sio-resume-actions"></div>';
    bar.querySelector('strong').textContent = 'Unfinished upload';
    bar.querySelector('span').textContent = left.length + ' file' + (left.length === 1 ? '' : 's') +
      ' (' + fmtBytes(bytes) + '): ' + names + '. Open the share, choose “Add files” and pick the same files – ShareIo continues where it stopped.';
    var actions = bar.querySelector('.sio-resume-actions');
    if (r.page) {
      var go = el('a', 'sio-btn sio-btn-primary', 'Open share');
      go.href = r.page;
      actions.appendChild(go);
    }
    var dismiss = el('button', 'sio-btn', 'Dismiss');
    dismiss.type = 'button';
    dismiss.title = 'Forget this upload';
    dismiss.addEventListener('click', function () {
      var a = load();
      open.forEach(function (k) { delete a[k]; });
      save(a);
      bar.remove();
    });
    actions.appendChild(dismiss);
    document.documentElement.appendChild(bar);
  }

  /* ---------- Hook into the app ---------- */

  function hook() {
    var app = window.elmApp;
    if (!app || !app.ports || !app.ports.submitFiles || !app.ports.uploadState) return false;
    app.ports.submitFiles.subscribe(function (data) {
      try { onSubmit(data); } catch (e) { if (window.console) console.warn('ShareIo uploads:', e); }
    });
    var port = app.ports.uploadState, send = port.send;
    port.send = function (msg) {
      try { onState(msg); } catch (e) { if (window.console) console.warn('ShareIo uploads:', e); }
      return send.apply(this, arguments);
    };
    return true;
  }

  function start() {
    baseTitle = document.title || baseTitle;
    if (!hook()) return;
    if (navigator.onLine === false) offline = true;
    showResumeBanner();
  }

  window.ShareIo = window.ShareIo || {};
  window.ShareIo.uploads = { batches: batches, setOffline: setOffline, retry: retryFailed, banner: showResumeBanner };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
