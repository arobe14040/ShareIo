/*
 * ShareIo UI enhancements
 *
 * Additive features on top of the bundled web app. Everything here is
 * optional: if an element is not found, the feature simply does nothing.
 *
 *  - Follows the system light/dark preference until a theme is picked
 *  - Paste files (Ctrl/Cmd+V) and drop files anywhere to upload
 *  - Share link: native "Share..." sheet, "Save QR" image, copy toast
 *  - Keyboard shortcuts: N = new share, A = new alias, / = search
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var assetBase = script ? script.src.replace(/[^/]*$/, '') : '';
  var prefix = (window.__ingress && window.__ingress.prefix) || '';

  var ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="m16 6-4-4-4 4"/><path d="M12 2v14"/></svg>',
    qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/></svg>',
    clip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>'
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function typing(ev) {
    var t = ev.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  /* ---------- Floating UI container ---------- */

  // One container at the end of <body>, after the app's own #main element.
  // Being inside <body> keeps our messages and buttons visible to screen
  // readers; staying outside #main keeps the app's rendering untouched.
  // The app removes unknown nodes from <body> when it redraws, so the same
  // element is re-attached whenever that happens (see start()).
  var rootEl = null;
  function uiRoot() {
    if (!rootEl) {
      rootEl = document.createElement('div');
      rootEl.id = 'sio-root';
    }
    if (!rootEl.isConnected) document.body.appendChild(rootEl);
    return rootEl;
  }

  /* ---------- Toasts ---------- */

  var toastBox;
  // toast(text, iconSvg) or toast(text, { icon: 'check'|'warn'|svg,
  //   action: { label, onClick }, duration: ms })
  function toast(text, opts) {
    if (typeof opts === 'string') opts = { icon: opts };
    opts = opts || {};
    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'sio-toasts';
      toastBox.setAttribute('role', 'status');
      toastBox.setAttribute('aria-live', 'polite');
      uiRoot().appendChild(toastBox);
    }
    var icon = ICON[opts.icon] || opts.icon || ICON.check;
    var el = document.createElement('div');
    el.className = 'sio-toast' + (opts.icon === 'warn' ? ' is-warn' : '');
    el.innerHTML = icon + '<span></span>';
    el.querySelector('span').textContent = text;
    var close = function () {
      if (el.classList.contains('is-leaving')) return;
      el.classList.add('is-leaving');
      setTimeout(function () { el.remove(); }, 220);
    };
    if (opts.action) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sio-toast-action';
      b.textContent = opts.action.label;
      b.addEventListener('click', function () { close(); opts.action.onClick(); });
      el.appendChild(b);
    }
    toastBox.appendChild(el);
    while (toastBox.children.length > 4) toastBox.firstChild.remove();
    setTimeout(close, opts.duration || 2400);
  }
  window.ShareIo = window.ShareIo || {};
  window.ShareIo.toast = toast;
  window.ShareIo.root = uiRoot;

  /* ---------- Theme follows the system until chosen ---------- */

  function storedTheme() {
    try { return localStorage.getItem('uiTheme'); } catch (e) { return null; }
  }
  function applySystemTheme() {
    if (storedTheme() || typeof window.applyUiTheme !== 'function') return;
    var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    window.applyUiTheme(dark ? 'dark' : 'light');
  }
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(applySystemTheme);
  }

  /* ---------- Upload: dropzone, paste, window drop ---------- */

  function fileInput() { return $('#content input[type="file"]'); }

  function addFiles(files) {
    var input = fileInput();
    if (!input || !files || !files.length || typeof DataTransfer === 'undefined') return false;
    var dt = new DataTransfer();
    Array.prototype.forEach.call(files, function (f) { dt.items.add(f); });
    // The app adds whatever is in the file picker to its list on every
    // change, so this appends. (Its dropzone ignores synthetic drops.)
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function enhanceDropzone() {
    var input = fileInput();
    if (!input) return;
    // The visible dropzone is the innermost box holding both the
    // "Drop files" heading and the file picker.
    var zone = null;
    $all('#content div').forEach(function (d) {
      if (d.contains(input) && /drop files/i.test(d.textContent || '')) zone = d;
    });
    // A data attribute survives the app redrawing the element; a class would not.
    if (zone && !zone.hasAttribute('data-sio-zone')) zone.setAttribute('data-sio-zone', '');
  }

  document.addEventListener('paste', function (ev) {
    if (!fileInput()) return;
    var files = ev.clipboardData && ev.clipboardData.files;
    if (!files || !files.length) return;
    ev.preventDefault();
    if (addFiles(files)) {
      toast(files.length === 1 ? 'Added 1 file from the clipboard' : 'Added ' + files.length + ' files from the clipboard', ICON.clip);
    }
  });

  var overlay, dragDepth = 0;
  function hasFiles(ev) {
    var types = ev.dataTransfer && ev.dataTransfer.types;
    return types && Array.prototype.indexOf.call(types, 'Files') !== -1;
  }
  function showOverlay(on) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sio-drop-overlay';
      overlay.innerHTML = '<div><img alt="" src="' + assetBase + 'img/icon.svg">Drop to add files<small>They will be added to this share</small></div>';
      uiRoot().appendChild(overlay);
    }
    overlay.classList.toggle('is-active', on);
  }
  window.addEventListener('dragenter', function (ev) {
    if (!hasFiles(ev) || !fileInput()) return;
    dragDepth++;
    showOverlay(true);
  });
  window.addEventListener('dragleave', function () {
    if (dragDepth > 0 && --dragDepth === 0) showOverlay(false);
  });
  window.addEventListener('dragover', function (ev) {
    if (hasFiles(ev) && fileInput()) ev.preventDefault();
  });
  window.addEventListener('drop', function (ev) {
    if (!hasFiles(ev) || !fileInput()) return;
    dragDepth = 0;
    showOverlay(false);
    // The overlay covers the page, so drops land here, not on the app.
    if (ev.defaultPrevented) return;
    ev.preventDefault();
    if (addFiles(ev.dataTransfer.files)) {
      var n = ev.dataTransfer.files.length;
      toast(n === 1 ? 'Added 1 file' : 'Added ' + n + ' files');
    }
  });

  /* ---------- Share link extras ---------- */

  function shareUrl(btn) {
    var target = btn.getAttribute('data-clipboard-target');
    var el = (target && $(target)) || btn.closest('div[class*="md:flex-row"]');
    var code = el && (el.matches && el.matches('code, pre') ? el : el.querySelector('code, pre'));
    return code ? code.textContent.trim() : '';
  }

  // The QR code is the largest SVG in the panel that is not one of our icons.
  function qrSvg(panel) {
    var best = null, bestSize = 0;
    $all('svg', panel).forEach(function (s) {
      if (s.closest('.sio-btn')) return;
      var r = s.getBoundingClientRect();
      if (r.width * r.height > bestSize) { best = s; bestSize = r.width * r.height; }
    });
    return bestSize > 4000 ? best : null;
  }

  function saveQr(svg, name) {
    var xml = new XMLSerializer().serializeToString(svg);
    if (xml.indexOf('xmlns=') === -1) xml = xml.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    var img = new Image();
    img.onload = function () {
      var size = 720, pad = 48;
      var c = document.createElement('canvas');
      c.width = c.height = size;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, pad, pad, size - 2 * pad, size - 2 * pad);
      c.toBlob(function (blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        toast('QR code saved', ICON.qr);
      }, 'image/png');
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  }

  /* ---------- Friend links (sidebar panel) ----------
   *
   * Inside the Home Assistant sidebar, the app's own share links point to the
   * internal ingress address, which nobody can open directly. Friend links
   * point to the ShareIo panel on Home Assistant's own address instead, e.g.
   *   https://ha.example.com/<panel>?shareio=/app/open/<id>
   * Anyone with a login to this Home Assistant can open them; the panel then
   * shows the share (see openDeepLink).
   */

  function haParent() {
    try {
      var p = window.parent;
      if (!p || p === window) return null;
      var ha = p.document.querySelector('home-assistant');
      return ha && ha.hass ? { win: p, hass: ha.hass } : null;
    } catch (e) {
      return null;  // not embedded in the Home Assistant frontend
    }
  }

  var friendBase = null;
  // Resolves to { url, scope } where scope is 'internet' or 'home'.
  function friendAddress() {
    if (friendBase) return friendBase;
    var ha = haParent();
    friendBase = (function () {
      if (!ha) return Promise.resolve(null);
      var cfg = ha.hass.config || {};
      var fallback = function () {
        if (cfg.external_url) return { url: cfg.external_url.replace(/\/+$/, ''), scope: 'internet' };
        return { url: ha.win.location.origin, scope: 'home' };
      };
      var usesCloud = (cfg.components || []).indexOf('cloud') !== -1;
      if (!usesCloud) return Promise.resolve(fallback());
      return ha.hass.callWS({ type: 'cloud/status' }).then(function (s) {
        if (s && s.logged_in && s.prefs && s.prefs.remote_enabled && s.remote_domain) {
          return { url: 'https://' + s.remote_domain, scope: 'internet' };
        }
        return fallback();
      }, fallback);
    })();
    return friendBase;
  }

  // "/app/open/<id>?view=1" from the app's own (ingress) share URL
  function innerPath(url) {
    var i = (url || '').indexOf('/app/');
    return i === -1 ? '' : url.slice(i);
  }

  function friendLink(url) {
    var ha = haParent();
    var path = innerPath(url);
    if (!ha || !path) return Promise.resolve(null);
    return friendAddress().then(function (addr) {
      if (!addr) return null;
      return {
        url: addr.url + ha.win.location.pathname + '?shareio=' + encodeURIComponent(path),
        scope: addr.scope
      };
    });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      uiRoot().appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      if (ok) resolve(); else reject(new Error('copy failed'));
    });
  }

  function qrSvgFor(text) {
    if (typeof window.qrcode !== 'function') return '';
    var qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }

  // Opening a friend link: Home Assistant shows the panel's start page, so
  // read ?shareio= from the Home Assistant address and open that page here.
  function openDeepLink() {
    var ha = haParent();
    if (!ha) return;
    var params = new URLSearchParams(ha.win.location.search);
    var target = params.get('shareio');
    if (!target) return;
    params.delete('shareio');
    var rest = params.toString();
    try {
      ha.win.history.replaceState(ha.win.history.state, '',
        ha.win.location.pathname + (rest ? '?' + rest : '') + ha.win.location.hash);
    } catch (e) { /* keep going */ }
    // Only pages of this app, never another site or path.
    if (!/^\/app\/[A-Za-z0-9\-_/]*(\?[A-Za-z0-9=&\-_]*)?$/.test(target)) return;
    if (location.pathname + location.search !== prefix + target) location.replace(prefix + target);
  }

  function enhanceFriendShare(btn) {
    var appUrl = shareUrl(btn);
    if (!prefix || !haParent() || !innerPath(appUrl)) return false;
    document.documentElement.classList.add('sio-friend-mode');

    var box = document.createElement('div');
    box.className = 'sio-friend';
    box.innerHTML = '<div class="sio-friend-head">' + ICON.share +
      '<strong>Share with a friend</strong></div>' +
      '<div class="sio-friend-url" tabindex="0"></div>' +
      '<div class="sio-friend-qr"></div>' +
      '<p class="sio-friend-note"></p>';
    btn.parentElement.appendChild(box);

    var current = null;
    friendLink(appUrl).then(function (link) {
      if (!link) { box.remove(); return; }
      current = link.url;
      box.querySelector('.sio-friend-url').textContent = link.url;
      box.querySelector('.sio-friend-qr').innerHTML = qrSvgFor(link.url);
      box.querySelector('.sio-friend-note').textContent = link.scope === 'internet'
        ? 'Anyone with a login to this Home Assistant can open it, from anywhere.'
        : 'Works on your home network for anyone with a login to this Home Assistant. ' +
          'Set up remote access (Home Assistant Cloud, or an Internet URL under ' +
          'Settings → System → Network) to share outside your home.';
    });

    // Copy the friend link instead of the internal address; this runs before
    // the app's own copy handler, which is stopped.
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var link = current;
      if (!link) return;
      copyText(link).then(function () {
        toast('Friend link copied');
      }, function () {
        toast('Copy failed – select the link and copy it', { icon: 'warn' });
      });
    });
    btn.dataset.sioFriend = '1';
    btn._sioFriendUrl = function () { return current; };
    return true;
  }

  function enhanceShareLink() {
    $all('#share-copy-to-clipboard-btn, [id$="copy-to-clipboard-btn"]').forEach(function (btn) {
      if (btn.dataset.sio) return;
      btn.dataset.sio = '1';
      if (!enhanceFriendShare(btn)) {
        btn.addEventListener('click', function () { toast('Link copied'); });
      }

      var bar = document.createElement('div');
      bar.className = 'sio-actions';

      if (navigator.share) {
        var s = document.createElement('button');
        s.type = 'button';
        s.className = 'sio-btn';
        s.innerHTML = ICON.share + '<span>Share&hellip;</span>';
        s.addEventListener('click', function () {
          var url = btn._sioFriendUrl ? btn._sioFriendUrl() : shareUrl(btn);
          if (url) navigator.share({ title: 'Files shared with ShareIo', url: url }).catch(function () {});
        });
        bar.appendChild(s);
      }

      var panel = btn.closest('div[class*="md:flex-row"]');
      if (panel && qrSvg(panel)) {
        var q = document.createElement('button');
        q.type = 'button';
        q.className = 'sio-btn';
        q.innerHTML = ICON.qr + '<span>Save QR</span>';
        q.addEventListener('click', function () {
          var id = (shareUrl(btn).split('/').pop() || 'share').split('?')[0];
          var qr = qrSvg(panel);
          if (qr) saveQr(qr, 'shareio-' + id + '.png');
        });
        bar.appendChild(q);
      }

      if (bar.children.length) btn.parentElement.appendChild(bar);
    });
  }

  /* ---------- Keyboard shortcuts ---------- */

  function go(page) {
    var link = $all('a[href]').filter(function (a) {
      return new RegExp('/app/' + page + '$').test(a.getAttribute('href'));
    })[0];
    if (link) { link.click(); return; }
    location.href = location.origin + prefix + '/app/' + page;
  }

  document.addEventListener('keydown', function (ev) {
    if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey || typing(ev)) return;
    var k = ev.key;
    if (k === 'n' || k === 'N') { ev.preventDefault(); go('share'); }
    else if (k === 'a' || k === 'A') { ev.preventDefault(); go('alias'); }
    else if (k === '/') {
      var search = $('#content input[type="text"][placeholder*="earch"]');
      if (search) { ev.preventDefault(); search.focus(); }
    }
  });

  /* ---------- Run on every page change ---------- */

  var queued = false;
  function enhance() {
    queued = false;
    try {
      enhanceDropzone();
      enhanceShareLink();
    } catch (e) {
      if (window.console) console.warn('ShareIo UI:', e);
    }
  }
  function schedule() {
    if (queued) return;
    queued = true;
    (window.requestAnimationFrame || setTimeout)(enhance);
  }

  function start() {
    openDeepLink();
    applySystemTheme();
    enhance();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    // Put our container back right after the app's redraw removes it, so
    // toasts, the upload card and banners survive page changes.
    new MutationObserver(function () {
      if (rootEl && !rootEl.isConnected && rootEl.childNodes.length) document.body.appendChild(rootEl);
    }).observe(document.body, { childList: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
