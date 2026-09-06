/* RoadCrew - js/client/settings.js
   The client-service desk's Settings. Two tabs, and deliberately only two: this
   account owns itself and the password its brand hands to the brand's own
   people. Company profile, brands, regions, check-in rules and the demo reset
   all stay with the coordinator, because the client kept master data there.
   Load order: data.js, util.js, auth.js, settings.js
   -------------------------------------------------------------------------- */

window.RoadCrew = window.RoadCrew || {};

(function (R) {
  'use strict';

  var me = R.auth.requireRole('client');
  if (!me) {
    return;
  }

  var U = R.util;

  var MY_BRAND = me.brandId || '';

  function byId(id) { return document.getElementById(id); }

  function trimmed(id) {
    return String(byId(id).value || '').replace(/^\s+|\s+$/g, '');
  }

  /* ------------------------------------------------------------- profile -- */

  // Always re-read the stored record rather than trusting the `me` captured at
  // load. A save writes to the database, and the next load has to show what is
  // actually there - not what was there when the page opened.
  function currentUser() {
    return R.db.byId('users', me.id);
  }

  function loadProfile() {
    var u = currentUser();
    if (!u) { return; }
    byId('p-name').value = u.name || '';
    byId('p-email').value = u.email || '';
    byId('p-phone').value = u.phone || '';
    byId('p-password').value = '';
  }

  function saveProfile() {
    var u = currentUser();
    if (!u) {
      U.toast('Your account could not be found.', 'danger');
      return;
    }

    var name = trimmed('p-name');
    if (!name) {
      U.toast('A name is required.', 'danger');
      return;
    }

    // Blank means keep. Writing the empty string here would lock the account out
    // of its own login, which is a strange way to reward leaving a field alone.
    var typed = String(byId('p-password').value || '');
    var password = typed === '' ? u.password : typed;

    // Email, role, brand, sub-region, status and avatar are copied through
    // untouched. Only three fields on this page are the account holder's to set;
    // rebuilding the record from the form would silently drop the rest.
    R.db.upsert('users', {
      id: u.id,
      name: name,
      email: u.email,
      password: password,
      role: u.role,
      subregionId: u.subregionId,
      brandId: u.brandId,
      phone: trimmed('p-phone'),
      status: u.status,
      avatar: u.avatar
    });

    loadProfile();
    renderChrome();
    U.toast(typed === '' ? 'Profile saved.' : 'Profile and password saved.', 'success');
  }

  /* --------------------------------------------------------------- brand -- */

  function currentBrand() {
    return MY_BRAND ? R.db.byId('brands', MY_BRAND) : null;
  }

  function loadBrand() {
    var b = currentBrand();
    if (!b) {
      // Users refuses to create a client without a brand, so this is a state the
      // app should never reach - but a page that renders nothing and says nothing
      // is worse than one that admits it.
      byId('b-name').value = 'No brand assigned';
      byId('b-report-password').value = '';
      byId('b-report-password').disabled = true;
      byId('b-save').disabled = true;
      byId('b-report-help').textContent =
        'Your account has no brand. Ask the coordinator to set one on the Users screen.';
      return;
    }
    byId('b-name').value = b.name || '';
    byId('b-color').value = b.color || '#C0392B';
    byId('b-report-password').value = b.reportPassword || '';
  }

  function saveBrand() {
    var b = currentBrand();
    if (!b) { return; }

    var password = trimmed('b-report-password');
    if (!password) {
      U.toast('A report password is required, or the report can never be opened.', 'danger');
      return;
    }

    // Name and colour are read back off the stored record, not off the disabled
    // inputs. A disabled field is a display, not a source of truth.
    R.db.upsert('brands', {
      id: b.id,
      name: b.name,
      color: b.color,
      reportPassword: password
    });

    loadBrand();
    U.toast('Report password saved.', 'success');
  }

  /* -------------------------------------------------------------- chrome -- */

  function renderChrome() {
    var u = currentUser() || me;
    var iso = U.todayISO();
    var d = U.fromISO(iso);
    byId('topbar-date').textContent =
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ', ' + U.fmtDate(iso);
    byId('topbar-initial').textContent = U.initials(u.name);
    byId('appbar-initial').textContent = U.initials(u.name);
    byId('side-initial').textContent = U.initials(u.name);
    byId('side-name').textContent = u.name;

    var brandEl = byId('side-brand');
    if (brandEl) {
      var b = currentBrand();
      brandEl.textContent = b ? b.name : 'No brand assigned';
    }
  }

  function on(id, event, fn) {
    var el = byId(id);
    if (el) { el.addEventListener(event, fn); }
  }

  /* ----------------------------------------------------------------- tabs -- */

  // Same machinery as the admin Settings, two panels instead of five.
  var TABS = ['profile', 'brand'];

  function showTab(name) {
    var want = TABS.indexOf(name) === -1 ? TABS[0] : name;
    var i;

    for (i = 0; i < TABS.length; i++) {
      var panel = byId('tab-' + TABS[i]);
      if (panel) { panel.hidden = TABS[i] !== want; }
    }

    var btns = document.querySelectorAll('[data-tab]');
    for (i = 0; i < btns.length; i++) {
      btns[i].className = 'viewseg-btn' +
        (btns[i].getAttribute('data-tab') === want ? ' is-active' : '');
    }

    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '#' + want);
    } else {
      window.location.hash = want;
    }
  }

  function tabFromHash() {
    var raw = String(window.location.hash || '').replace('#', '');
    return TABS.indexOf(raw) === -1 ? TABS[0] : raw;
  }

  function wire() {
    var i;

    var tabs = document.querySelectorAll('[data-tab]');
    for (i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function (ev) {
        showTab(ev.currentTarget.getAttribute('data-tab'));
      });
    }

    window.addEventListener('hashchange', function () {
      showTab(tabFromHash());
    });

    var outs = document.querySelectorAll('[data-logout]');
    for (i = 0; i < outs.length; i++) {
      outs[i].addEventListener('click', function () { R.auth.logout(); });
    }

    on('p-save', 'click', saveProfile);
    on('b-save', 'click', saveBrand);
  }

  function init() {
    R.auth.consumeWrongPortalFlag();

    renderChrome();
    loadProfile();
    loadBrand();
    wire();
    showTab(tabFromHash());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.RoadCrew);
