/*
 * ShareIo first-run setup
 *
 * Until a storage location is chosen, the sidebar panel asks an admin where
 * ShareIo should keep its files: in ShareIo's own data, or in the Share or
 * Media folder (with a folder browser). The choice is saved to the add-on's
 * options through Home Assistant and the add-on restarts. It can be changed
 * later under Configuration ("Storage location" and "Storage folder").
 */
(function () {
  'use strict';

  var prefix = (window.__ingress && window.__ingress.prefix) || '';
  if (!prefix) return;  // only inside the Home Assistant sidebar

  var CHOICES = [
    { id: 'addon_data', title: 'In ShareIo', badge: 'Recommended',
      text: 'Private to ShareIo and included in ShareIo’s backups.' },
    { id: 'share', title: 'Share folder',
      text: 'Also reachable with Samba or file browser add-ons. Include the Share folder in your backups.' },
    { id: 'media', title: 'Media folder',
      text: 'Next to your media library. Include the Media folder in your backups.' }
  ];

  function ha() { return window.ShareIo && window.ShareIo.haParent && window.ShareIo.haParent(); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function root() { return (window.ShareIo && window.ShareIo.root) ? window.ShareIo.root() : document.body; }

  function start() {
    try { if (sessionStorage.getItem('shareio-setup-later')) return; } catch (e) { /* ignore */ }
    fetch(prefix + '/app/shareio-setup/state.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (st) { if (st && st.setup) show(st); })
      .catch(function () {});
  }

  function show(st) {
    var h = ha();
    var admin = !!(h && h.hass && h.hass.user && h.hass.user.is_admin);

    var overlay = el('div', 'sio-setup');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'sio-setup-title');
    var box = el('div', 'sio-setup-box');
    overlay.appendChild(box);
    var title = el('h2', null, 'Where should ShareIo store files?');
    title.id = 'sio-setup-title';
    box.appendChild(title);

    if (!admin) {
      box.appendChild(el('p', 'sio-setup-lead',
        'An administrator still needs to choose where ShareIo keeps its files. ' +
        'You can already use ShareIo; files are kept in ShareIo for now.'));
      var ok = el('button', 'sio-btn sio-btn-primary', 'OK');
      ok.type = 'button';
      ok.addEventListener('click', later);
      box.appendChild(el('div', 'sio-setup-actions')).appendChild(ok);
      root().appendChild(overlay);
      return;
    }

    box.appendChild(el('p', 'sio-setup-lead',
      'Files are stored on disk. You can change this later on the add-on’s Configuration tab.'));

    var state = { location: 'addon_data', folder: '' };
    var list = el('div', 'sio-setup-choices');
    box.appendChild(list);
    CHOICES.forEach(function (c) {
      var label = el('label', 'sio-setup-choice');
      var radio = el('input');
      radio.type = 'radio';
      radio.name = 'sio-storage';
      radio.value = c.id;
      radio.checked = c.id === state.location;
      radio.addEventListener('change', function () {
        state.location = c.id;
        state.folder = '';
        renderBrowser();
      });
      var body = el('span', 'sio-setup-choice-body');
      var head = el('strong', null, c.title);
      if (c.badge) head.appendChild(el('em', null, c.badge));
      body.appendChild(head);
      body.appendChild(el('span', null, c.text));
      label.appendChild(radio);
      label.appendChild(body);
      list.appendChild(label);
    });

    var browser = el('div', 'sio-setup-browser');
    box.appendChild(browser);

    var status = el('p', 'sio-setup-status');
    status.setAttribute('aria-live', 'polite');
    box.appendChild(status);

    var actions = el('div', 'sio-setup-actions');
    var laterBtn = el('button', 'sio-btn', 'Later');
    laterBtn.type = 'button';
    laterBtn.addEventListener('click', later);
    var save = el('button', 'sio-btn sio-btn-primary', 'Save and restart');
    save.type = 'button';
    save.addEventListener('click', function () { apply(st, state, save, laterBtn, status); });
    actions.appendChild(laterBtn);
    actions.appendChild(save);
    box.appendChild(actions);

    function target() {
      if (state.location === 'addon_data') return 'ShareIo’s own data';
      return '/' + state.location + '/' + (state.folder ? state.folder + '/' : '') + 'ShareIo';
    }

    function renderBrowser() {
      browser.innerHTML = '';
      if (state.location === 'addon_data') {
        browser.appendChild(el('p', 'sio-setup-target', 'Files will be stored in ' + target() + '.'));
        return;
      }
      var crumbs = el('div', 'sio-setup-crumbs');
      var parts = state.folder ? state.folder.split('/') : [];
      var rootCrumb = el('button', 'sio-setup-crumb', '/' + state.location);
      rootCrumb.type = 'button';
      rootCrumb.addEventListener('click', function () { state.folder = ''; renderBrowser(); });
      crumbs.appendChild(rootCrumb);
      parts.forEach(function (p, i) {
        crumbs.appendChild(el('span', null, '/'));
        var b = el('button', 'sio-setup-crumb', p);
        b.type = 'button';
        b.addEventListener('click', function () { state.folder = parts.slice(0, i + 1).join('/'); renderBrowser(); });
        crumbs.appendChild(b);
      });
      browser.appendChild(crumbs);

      var folders = el('ul', 'sio-setup-folders');
      folders.appendChild(el('li', 'sio-setup-loading', 'Loading folders…'));
      browser.appendChild(folders);
      browser.appendChild(el('p', 'sio-setup-target', 'Files will be stored in ' + target() +
        ' (a ShareIo folder is created there).'));

      var url = prefix + '/app/shareio-setup/browse/' + state.location + '/' +
        (state.folder ? state.folder.split('/').map(encodeURIComponent).join('/') + '/' : '');
      fetch(url, { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (entries) {
          folders.innerHTML = '';
          var dirs = entries.filter(function (e) {
            return e.type === 'directory' && e.name.charAt(0) !== '.' && e.name !== 'ShareIo';
          }).sort(function (a, b) { return a.name.localeCompare(b.name); });
          if (!dirs.length) folders.appendChild(el('li', 'sio-setup-empty', 'No subfolders'));
          dirs.forEach(function (d) {
            var li = el('li');
            var b = el('button', 'sio-setup-folder', d.name);
            b.type = 'button';
            b.addEventListener('click', function () {
              state.folder = (state.folder ? state.folder + '/' : '') + d.name;
              renderBrowser();
            });
            li.appendChild(b);
            folders.appendChild(li);
          });
        })
        .catch(function () {
          folders.innerHTML = '';
          folders.appendChild(el('li', 'sio-setup-empty', 'Could not list folders here.'));
        });
    }

    renderBrowser();
    root().appendChild(overlay);
    save.focus();
  }

  function later() {
    try { sessionStorage.setItem('shareio-setup-later', '1'); } catch (e) { /* ignore */ }
    var o = document.querySelector('.sio-setup');
    if (o) o.remove();
  }

  function apply(st, state, save, laterBtn, status) {
    var h = ha();
    if (!h) return;
    var call = function (endpoint, method, data) {
      var msg = { type: 'supervisor/api', endpoint: endpoint, method: method };
      if (data) msg.data = data;
      return h.hass.callWS(msg);
    };
    save.disabled = laterBtn.disabled = true;
    status.textContent = 'Saving…';
    call('/addons/' + st.slug + '/info', 'get')
      .then(function (info) {
        var opts = Object.assign({}, info.options || {});
        opts.storage_location = state.location;
        if (state.location !== 'addon_data' && state.folder) opts.storage_folder = state.folder;
        else delete opts.storage_folder;
        return call('/addons/' + st.slug + '/options', 'post', { options: opts });
      })
      .then(function () {
        status.textContent = 'Restarting ShareIo… this takes about half a minute.';
        // The restart stops the server answering this page; wait for it to come back.
        call('/addons/' + st.slug + '/restart', 'post').catch(function () {});
        waitForRestart();
      })
      .catch(function (err) {
        save.disabled = laterBtn.disabled = false;
        status.textContent = 'Could not save: ' + ((err && err.message) || err || 'unknown error');
      });
  }

  function waitForRestart() {
    var started = Date.now(), sawDown = false;
    (function poll() {
      fetch(prefix + '/app/shareio-setup/state.json', { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (st) {
          if (st && !st.setup && (sawDown || Date.now() - started > 8000)) location.reload();
          else setTimeout(poll, 2000);
        })
        .catch(function () { sawDown = true; setTimeout(poll, 2000); });
    })();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
