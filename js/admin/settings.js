/* RoadCrew - js/admin/settings.js
   Brief section 5.5: company profile, brands, check-in rules, demo reset.
   Load order: data.js, util.js, auth.js, settings.js
   -------------------------------------------------------------------------- */

window.RoadCrew = window.RoadCrew || {};

(function (R) {
  'use strict';

  var me = R.auth.requireRole('admin');
  if (!me) {
    return;
  }

  var U = R.util;

  var editingBrandId = '';   // '' while the inline form is in "add" mode
  var pending = null;        // { kind: 'brand'|'reset', id: '' } queued for confirm

  function byId(id) { return document.getElementById(id); }

  // Settings is a single object, so every save reads the whole state,
  // mutates state.settings and writes the state back.
  function patchSettings(mutate) {
    var state = R.db.load();
    if (!state.settings) { state.settings = {}; }
    mutate(state.settings);
    R.db.save(state);
    return state.settings;
  }

  /* ------------------------------------------------------------- company -- */

  function loadCompany() {
    var s = R.db.settings() || {};
    byId('s-company').value = s.companyName || '';
    byId('s-email').value = s.contactEmail || '';
    byId('s-phone').value = s.contactPhone || '';
  }

  function saveCompany() {
    var name = String(byId('s-company').value || '').replace(/^\s+|\s+$/g, '');
    if (!name) {
      U.toast('Company name cannot be empty.', 'danger');
      return;
    }
    var email = String(byId('s-email').value || '').replace(/^\s+|\s+$/g, '');
    var phone = String(byId('s-phone').value || '').replace(/^\s+|\s+$/g, '');

    patchSettings(function (settings) {
      settings.companyName = name;
      settings.contactEmail = email;
      settings.contactPhone = phone;
    });

    loadCompany();
    U.toast('Company profile saved.', 'success');
  }

  /* -------------------------------------------------------------- brands -- */

  function usageOf(brandId) {
    var all = R.db.schedules();
    var n = 0;
    var i;
    for (i = 0; i < all.length; i++) {
      if (all[i] && all[i].brandId === brandId) { n += 1; }
    }
    return n;
  }

  function usageLabel(n) {
    return n + (n === 1 ? ' schedule' : ' schedules');
  }

  // A brand left without a report password could never have its report opened,
  // so an empty field falls back to a slug of the name plus the year.
  function defaultReportPassword(name) {
    var slug = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return (slug || 'report') + '2026';
  }

  function renderBrands() {
    var brands = R.db.brands();
    var html = '';
    var i;

    for (i = 0; i < brands.length; i++) {
      var b = brands[i];
      var used = usageOf(b.id);

      html +=
        '<tr>' +
          '<td>' +
            '<span class="row row-gap">' +
              '<span class="dot" style="background:' + U.escapeHtml(b.color) + '"></span>' +
              '<span>' + U.escapeHtml(b.name) + '</span>' +
            '</span>' +
          '</td>' +
          '<td class="muted">' + (U.escapeHtml(b.reportPassword || '') || '&mdash;') + '</td>' +
          '<td class="muted">' + U.escapeHtml(usageLabel(used)) + '</td>' +
          '<td>' +
            '<span class="sched-actions">' +
              '<button class="sched-act" type="button" data-brand-edit="' + U.escapeHtml(b.id) + '" title="Edit">&#9998;</button>' +
              '<button class="sched-act" type="button" data-brand-delete="' + U.escapeHtml(b.id) + '" title="Delete">&#10005;</button>' +
            '</span>' +
          '</td>' +
        '</tr>';
    }

    byId('brand-rows').innerHTML = html ||
      '<tr><td colspan="4"><div class="empty"><div class="empty-text">' +
      'No brands yet. Add one below.</div></div></td></tr>';
  }

  function resetBrandForm() {
    editingBrandId = '';
    byId('b-name').value = '';
    byId('b-color').value = '#C0392B';
    byId('b-report-password').value = '';
    byId('b-add').textContent = 'Add brand';
    byId('b-cancel').hidden = true;
  }

  function editBrand(id) {
    var b = R.db.byId('brands', id);
    if (!b) { return; }
    editingBrandId = b.id;
    byId('b-name').value = b.name;
    byId('b-color').value = b.color || '#C0392B';
    byId('b-report-password').value = b.reportPassword || '';
    byId('b-add').textContent = 'Save brand';
    byId('b-cancel').hidden = false;
    byId('b-name').focus();
  }

  function submitBrand() {
    var name = String(byId('b-name').value || '').replace(/^\s+|\s+$/g, '');
    var color = String(byId('b-color').value || '#C0392B');
    var reportPassword =
      String(byId('b-report-password').value || '').replace(/^\s+|\s+$/g, '');

    if (!name) {
      U.toast('Give the brand a name first.', 'danger');
      return;
    }

    var brands = R.db.brands();
    var i;
    for (i = 0; i < brands.length; i++) {
      if (brands[i].id !== editingBrandId &&
          brands[i].name.toLowerCase() === name.toLowerCase()) {
        U.toast('A brand called ' + name + ' already exists.', 'danger');
        return;
      }
    }

    var editing = !!editingBrandId;

    if (!reportPassword) {
      reportPassword = defaultReportPassword(name);
    }

    // Persisting through R.db.upsert is all it takes: the schedule drawer
    // reads R.db.brands() every time it opens, so a new brand is selectable
    // there straight away.
    R.db.upsert('brands', {
      id: editingBrandId || U.uid('b'),
      name: name,
      color: color,
      reportPassword: reportPassword
    });

    resetBrandForm();
    renderBrands();
    U.toast(editing ? 'Brand updated.' : 'Brand added.', 'success');
  }

  // A brand still attached to a schedule is never deleted - the guard fires
  // before the confirm modal ever opens.
  function askDeleteBrand(id) {
    var b = R.db.byId('brands', id);
    if (!b) { return; }

    var used = usageOf(b.id);
    if (used > 0) {
      U.toast(b.name + ' is used by ' + usageLabel(used) + ' and cannot be deleted.', 'danger');
      return;
    }

    pending = { kind: 'brand', id: b.id };
    byId('confirm-title').textContent = 'Delete this brand?';
    byId('confirm-text').textContent =
      b.name + ' is not used by any schedule. Deleting it removes it from the ' +
      'brand picker for good.';
    byId('confirm-yes').textContent = 'Delete brand';
    byId('confirm').className = 'modal is-open';
  }

  /* ---------------------------------------------------------- check-ins -- */

  function loadCheckin() {
    var s = R.db.settings() || {};
    var c = s.checkin || {};
    byId('c-photo').checked = c.photoRequired !== false;
    byId('c-start').value = c.windowStart || '09:00';
    byId('c-end').value = c.windowEnd || '19:00';
    byId('c-max').value = c.maxPhotos || 3;
  }

  function saveCheckin() {
    var start = String(byId('c-start').value || '');
    var end = String(byId('c-end').value || '');
    var max = parseInt(byId('c-max').value, 10);

    if (!start || !end) {
      U.toast('Set both ends of the check-in window.', 'danger');
      return;
    }
    if (end <= start) {
      U.toast('The check-in window must close after it opens.', 'danger');
      return;
    }
    if (isNaN(max) || max < 1) {
      U.toast('Allow at least one photo per event.', 'danger');
      return;
    }

    var required = byId('c-photo').checked;

    patchSettings(function (settings) {
      settings.checkin = {
        photoRequired: required,
        windowStart: start,
        windowEnd: end,
        maxPhotos: max
      };
    });

    loadCheckin();
    U.toast('Check-in rules saved.', 'success');
  }

  /* ---------------------------------------------------------- demo data -- */

  function askReset() {
    pending = { kind: 'reset', id: '' };
    byId('confirm-title').textContent = 'Reset demo data?';
    byId('confirm-text').textContent =
      'Every brand, schedule, user and uploaded photo stored in this browser is ' +
      'replaced with the original sample data. You will be signed out.';
    byId('confirm-yes').textContent = 'Reset demo data';
    byId('confirm').className = 'modal is-open';
  }

  function closeConfirm() {
    pending = null;
    byId('confirm').className = 'modal';
  }

  function runPending() {
    if (!pending) {
      closeConfirm();
      return;
    }

    if (pending.kind === 'reset') {
      R.db.reset();
      // reset() clears the session too, so a normal in-app link would only
      // bounce through the guard - go straight back to the landing page.
      window.location.href = '../index.html';
      return;
    }

    if (pending.kind === 'brand') {
      var id = pending.id;
      var b = R.db.byId('brands', id);
      var used = b ? usageOf(id) : 0;
      // Second read of the guard: the count is checked again at the moment
      // of deletion, not only when the modal opened.
      if (b && used === 0) {
        R.db.remove('brands', id);
        U.toast('Brand deleted.', 'info');
      } else if (b) {
        U.toast(b.name + ' is used by ' + usageLabel(used) + ' and cannot be deleted.', 'danger');
      }
      closeConfirm();
      if (editingBrandId === id) { resetBrandForm(); }
      renderBrands();
      return;
    }

    closeConfirm();
  }

  /* --------------------------------------------------------------- chrome -- */

  function renderChrome() {
    var iso = U.todayISO();
    var d = U.fromISO(iso);
    byId('topbar-date').textContent =
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ', ' + U.fmtDate(iso);
    byId('topbar-initial').textContent = U.initials(me.name);
    byId('appbar-initial').textContent = U.initials(me.name);
    byId('side-initial').textContent = U.initials(me.name);
    byId('side-name').textContent = me.name;
  }

  function on(id, event, fn) {
    var el = byId(id);
    if (el) { el.addEventListener(event, fn); }
  }

  function wire() {
    var i;

    var outs = document.querySelectorAll('[data-logout]');
    for (i = 0; i < outs.length; i++) {
      outs[i].addEventListener('click', function () { R.auth.logout(); });
    }

    on('s-save', 'click', saveCompany);
    on('c-save', 'click', saveCheckin);
    on('b-add', 'click', submitBrand);
    on('b-cancel', 'click', resetBrandForm);
    on('demo-reset', 'click', askReset);

    byId('brand-rows').addEventListener('click', function (ev) {
      var node = ev.target;
      while (node && node !== this) {
        if (node.getAttribute) {
          if (node.getAttribute('data-brand-edit')) {
            editBrand(node.getAttribute('data-brand-edit'));
            return;
          }
          if (node.getAttribute('data-brand-delete')) {
            askDeleteBrand(node.getAttribute('data-brand-delete'));
            return;
          }
        }
        node = node.parentNode;
      }
    });

    on('confirm-no', 'click', closeConfirm);
    on('confirm-yes', 'click', runPending);
  }

  function init() {
    R.auth.consumeWrongPortalFlag();

    renderChrome();
    loadCompany();
    loadCheckin();
    resetBrandForm();
    renderBrands();
    wire();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.RoadCrew);
