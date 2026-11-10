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
    clip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>'
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function typing(ev) {
    var t = ev.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  /* ---------- Toasts ---------- */

  var toastBox;
  function toast(text, icon) {
    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'sio-toasts';
      toastBox.setAttribute('role', 'status');
      toastBox.setAttribute('aria-live', 'polite');
      document.documentElement.appendChild(toastBox);
    }
    var el = document.createElement('div');
    el.className = 'sio-toast';
    el.innerHTML = (icon || ICON.check) + '<span></span>';
    el.lastChild.textContent = text;
    toastBox.appendChild(el);
    setTimeout(function () {
      el.classList.add('is-leaving');
      setTimeout(function () { el.remove(); }, 220);
    }, 2200);
  }

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

  // True while we pass files to the app's dropzone, so our own window
  // drag listeners ignore those forwarded events.
  var forwarding = false;

  function addFiles(files) {
    var input = fileInput();
    if (!input || !files || !files.length || typeof DataTransfer === 'undefined') return false;
    var dt = new DataTransfer();
    Array.prototype.forEach.call(files, function (f) { dt.items.add(f); });
    // Hand the files to the app's own dropzone: it appends to the list,
    // while setting the file input again can replace or be ignored.
    var zone = $('[data-sio-zone]');
    if (zone && typeof DragEvent === 'function') {
      forwarding = true;
      try {
        ['dragenter', 'dragover', 'drop'].forEach(function (type) {
          zone.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
        });
      } finally {
        forwarding = false;
      }
      return true;
    }
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
      document.documentElement.appendChild(overlay);
    }
    overlay.classList.toggle('is-active', on);
  }
  window.addEventListener('dragenter', function (ev) {
    if (forwarding || !hasFiles(ev) || !fileInput()) return;
    dragDepth++;
    showOverlay(true);
  });
  window.addEventListener('dragleave', function () {
    if (forwarding) return;
    if (dragDepth > 0 && --dragDepth === 0) showOverlay(false);
  });
  window.addEventListener('dragover', function (ev) {
    if (!forwarding && hasFiles(ev) && fileInput()) ev.preventDefault();
  });
  window.addEventListener('drop', function (ev) {
    if (forwarding || !hasFiles(ev) || !fileInput()) return;
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

  function enhanceShareLink() {
    $all('#share-copy-to-clipboard-btn, [id$="copy-to-clipboard-btn"]').forEach(function (btn) {
      if (btn.dataset.sio) return;
      btn.dataset.sio = '1';
      btn.addEventListener('click', function () { toast('Link copied'); });

      var bar = document.createElement('div');
      bar.className = 'sio-actions';

      if (navigator.share) {
        var s = document.createElement('button');
        s.type = 'button';
        s.className = 'sio-btn';
        s.innerHTML = ICON.share + '<span>Share&hellip;</span>';
        s.addEventListener('click', function () {
          var url = shareUrl(btn);
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
    applySystemTheme();
    enhance();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
