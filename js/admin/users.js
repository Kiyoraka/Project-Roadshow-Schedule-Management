/* RoadCrew - js/admin/users.js
   Artboard 10 (mobile user cards) plus the desktop users table and the
   add / edit drawer.
   Load order: data.js, util.js, auth.js, users.js
   -------------------------------------------------------------------------- */

window.RoadCrew = window.RoadCrew || {};

(function (R) {
  'use strict';

  var me = R.auth.requireRole('admin');
  if (!me) {
    return;
  }

  var U = R.util;

  var region = '';     // '' = All, otherwise a region id
  var draft = null;    // user being created or edited
  var pending = null;  // id queued for deactivation
  var page = 1;

  // Artboard 10 right-aligns the status and the event count against the card
  // edge. Nothing in base.css does that, and the brief forbids new CSS, so the
  // one alignment rule rides along inline - the same way schedules.js passes
  // its brand tint.
  var RIGHT = 'text-align:right;flex:none';

  function byId(id) { return document.getElementById(id); }
  function asset(p) { return '../' + String(p || ''); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function nameOf(collection, id) {
    var rec = R.db.byId(collection, id);
    return rec ? rec.name : '';
  }

  function regionLabel(u) {
    return nameOf('regions', u.regionId) || 'All regions';
  }

  /* ---------------------------------------------------------------- counts -- */

  // Schedules this user is on where any covered day falls in the current
  // calendar month. Cancelled work never counts.
  function eventsThisMonth(userId) {
    var all = R.db.schedules();
    var month = U.todayISO().slice(0, 7);
    var count = 0;
    var i, j, days;

    for (i = 0; i < all.length; i++) {
      var s = all[i];
      if (U.deriveStatus(s) === 'cancelled') { continue; }
      if (!s.spIds || s.spIds.indexOf(userId) === -1) { continue; }
      days = U.daysBetween(s.startDate, s.endDate);
      for (j = 0; j < days.length; j++) {
        if (days[j].slice(0, 7) === month) {
          count++;
          break;
        }
      }
    }
    return count;
  }

  // The artboard singularises: '1 event this month', not '1 events'.
  function eventsLabel(n) {
    return n === 1 ? '1 event this month' : n + ' events this month';
  }

  /* --------------------------------------------------------------- filter -- */

  function visible() {
    var all = R.db.users();
    var out = [];
    var i;
    for (i = 0; i < all.length; i++) {
      if (region && all[i].regionId !== region) { continue; }
      out.push(all[i]);
    }
    return out;
  }

  function renderChips() {
    var regions = R.db.regions();
    var html = '<button class="chip' + (region === '' ? ' is-active' : '') +
               '" type="button" data-region="">All</button>';
    var i;
    for (i = 0; i < regions.length; i++) {
      html += '<button class="chip' + (regions[i].id === region ? ' is-active' : '') +
              '" type="button" data-region="' + U.escapeHtml(regions[i].id) + '">' +
              U.escapeHtml(regions[i].name) + '</button>';
    }
    byId('region-chips').innerHTML = html;
  }

  /* ----------------------------------------------------------------- list -- */

  function statusBadge(u) {
    return u.status === 'inactive'
      ? '<span class="badge badge-planned">Inactive</span>'
      : '<span class="badge badge-completed">Active</span>';
  }

  // The signed-in admin can never be switched off, and an already inactive
  // user has nothing left to deactivate.
  function canDeactivate(u) {
    return !!u && u.id !== me.id && u.status !== 'inactive';
  }

  function render() {
    // Same shape as the Schedules list: one slice feeds the desktop table and
    // the mobile cards, and paginate clamps so a deactivation on the last page
    // cannot strand you on an empty one.
    var pageState = U.paginate(visible(), page);
    var rows = pageState.rows;
    page = pageState.page;

    var htmlRows = '';
    var htmlCards = '';
    var i;

    for (i = 0; i < rows.length; i++) {
      var u = rows[i];
      var inactive = u.status === 'inactive';
      var off = canDeactivate(u);
      var count = eventsThisMonth(u.id);

      htmlRows +=
        '<tr' + (inactive ? ' class="row-cancelled"' : '') + '>' +
          '<td>' +
            '<div class="row row-gap">' +
              '<img class="avatar avatar-sm" src="' + U.escapeHtml(asset(u.avatar)) + '" alt="">' +
              '<span>' + U.escapeHtml(u.name) + '</span>' +
            '</div>' +
          '</td>' +
          '<td class="muted">' + U.escapeHtml(u.email) + '</td>' +
          '<td class="muted">' + U.escapeHtml(u.phone) + '</td>' +
          '<td>' + U.escapeHtml(regionLabel(u)) + '</td>' +
          '<td>' + U.escapeHtml(cap(u.role)) + '</td>' +
          '<td>' + statusBadge(u) + '</td>' +
          '<td>' +
            '<div class="sched-actions">' +
              '<button class="sched-act" type="button" data-edit="' + U.escapeHtml(u.id) +
                '" title="Edit">&#9998;</button>' +
              '<button class="sched-act" type="button" data-off="' + U.escapeHtml(u.id) +
                '" title="Deactivate"' + (off ? '' : ' disabled') + '>&#10005;</button>' +
            '</div>' +
          '</td>' +
        '</tr>';

      // Mobile card (artboard 10): avatar, name, '<Region> · <phone>', the
      // Active / Inactive badge and the event count.
      htmlCards +=
        '<div class="card card-tight feed-row" data-edit="' + U.escapeHtml(u.id) + '"' +
          (inactive ? ' style="opacity:.55"' : '') + '>' +
          '<img class="feed-avatar" src="' + U.escapeHtml(asset(u.avatar)) + '" alt="">' +
          '<div class="feed-who">' +
            '<div class="feed-name">' + U.escapeHtml(u.name) + '</div>' +
            '<div class="feed-place">' +
              U.escapeHtml(regionLabel(u) + ' · ' + u.phone) +
            '</div>' +
          '</div>' +
          '<div style="' + RIGHT + '">' +
            statusBadge(u) +
            '<div class="caption nowrap">' + U.escapeHtml(eventsLabel(count)) + '</div>' +
          '</div>' +
        '</div>';
    }

    byId('user-rows').innerHTML = htmlRows ||
      '<tr><td colspan="7"><div class="empty"><div class="empty-text">No users in this region.</div></div></td></tr>';
    byId('user-cards').innerHTML = htmlCards ||
      '<div class="empty"><div class="empty-text">No users in this region.</div></div>';
    byId('user-foot').innerHTML = U.pagerHtml(pageState, 'users');
  }

  // Picking a region changes which users exist, not which page of them you are
  // looking at, so the page number goes back to the start.
  function resetPage() { page = 1; }

  /* --------------------------------------------------------------- drawer -- */

  function blank() {
    return {
      id: '',
      name: '',
      email: '',
      password: 'admin123',
      role: 'staff',
      regionId: '',
      phone: '',
      status: 'active',
      avatar: 'img/avatar-01.svg'
    };
  }

  function regionOptions(selected) {
    var regions = R.db.regions();
    var html = '<option value="">All regions</option>';
    var i;
    for (i = 0; i < regions.length; i++) {
      html += '<option value="' + U.escapeHtml(regions[i].id) + '"' +
              (regions[i].id === selected ? ' selected' : '') + '>' +
              U.escapeHtml(regions[i].name) + '</option>';
    }
    return html;
  }

  function openDrawer(id) {
    var existing = id ? R.db.byId('users', id) : null;

    if (existing) {
      draft = {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        password: existing.password,
        role: existing.role,
        regionId: existing.regionId || '',
        phone: existing.phone,
        status: existing.status,
        avatar: existing.avatar
      };
      byId('drawer-title').textContent = 'Edit user';
    } else {
      draft = blank();
      byId('drawer-title').textContent = 'Add user';
    }

    byId('u-name').value = draft.name;
    byId('u-email').value = draft.email;
    byId('u-phone').value = draft.phone;
    byId('u-region').innerHTML = regionOptions(draft.regionId);
    byId('u-region').value = draft.regionId;
    byId('u-role').value = draft.role;
    byId('u-status').value = draft.status;

    byId('drawer').className = 'drawer is-open';
    byId('drawer').setAttribute('aria-hidden', 'false');
    byId('scrim').className = 'scrim is-open';
  }

  function closeDrawer() {
    draft = null;
    byId('drawer').className = 'drawer';
    byId('drawer').setAttribute('aria-hidden', 'true');
    byId('scrim').className = 'scrim';
  }

  function saveDraft() {
    if (!draft) { return; }

    var name = byId('u-name').value.replace(/^\s+|\s+$/g, '');
    var email = byId('u-email').value.replace(/^\s+|\s+$/g, '');
    var phone = byId('u-phone').value.replace(/^\s+|\s+$/g, '');
    var regionId = byId('u-region').value;
    var role = byId('u-role').value;
    var status = byId('u-status').value;

    if (!name) {
      U.toast('A name is required.', 'danger');
      return;
    }
    if (!email) {
      U.toast('An email is required.', 'danger');
      return;
    }

    // The status select is the other road to deactivation. It is closed to the
    // signed-in admin too, so there is no way around the disabled action.
    if (draft.id === me.id && status === 'inactive') {
      U.toast('You cannot deactivate your own account.', 'danger');
      return;
    }

    var record = {
      id: draft.id || U.uid('u'),
      name: name,
      email: email,
      password: draft.password || 'admin123',
      role: role,
      regionId: regionId || null,
      phone: phone,
      status: status,
      avatar: draft.avatar || 'img/avatar-01.svg'
    };

    var isNew = !draft.id;

    R.db.upsert('users', record);
    closeDrawer();
    // A new user appends to the end of the list, so jump to the last page to
    // show it rather than leaving the reader wondering whether it saved.
    if (isNew) { page = Math.ceil(visible().length / U.PAGE_SIZE); }
    render();
    U.toast('User saved.', 'success');
  }

  /* ----------------------------------------------------------- deactivate -- */

  function askDeactivate(id) {
    var u = R.db.byId('users', id);
    if (!u) { return; }

    if (u.id === me.id) {
      U.toast('You cannot deactivate your own account.', 'danger');
      return;
    }
    if (u.status === 'inactive') {
      U.toast(u.name + ' is already inactive.', 'info');
      return;
    }

    pending = id;
    byId('confirm-text').textContent =
      u.name + ' keeps every past schedule and check-in, but cannot log in or be ' +
      'added to new work until reactivated.';
    byId('confirm').className = 'modal is-open';
  }

  function closeConfirm() {
    pending = null;
    byId('confirm').className = 'modal';
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

    byId('region-chips').addEventListener('click', function (ev) {
      var node = ev.target;
      while (node && node !== this) {
        if (node.getAttribute && node.getAttribute('data-region') !== null) {
          region = node.getAttribute('data-region');
          resetPage();
          renderChips();
          render();
          return;
        }
        node = node.parentNode;
      }
    });

    // Bound to the footer, which survives every render, rather than to the
    // buttons inside it, which do not.
    on('user-foot', 'click', function (ev) {
      var node = ev.target;
      while (node && node !== this) {
        var want = node.getAttribute && node.getAttribute('data-page');
        if (want) {
          page = U.pageFromClick(want, page);
          render();
          return;
        }
        node = node.parentNode;
      }
    });

    on('btn-new', 'click', function () { openDrawer(null); });
    on('drawer-close', 'click', closeDrawer);
    on('u-cancel', 'click', closeDrawer);
    on('scrim', 'click', closeDrawer);
    on('u-save', 'click', saveDraft);

    on('confirm-no', 'click', closeConfirm);
    on('confirm-yes', 'click', function () {
      var u = pending ? R.db.byId('users', pending) : null;
      // Belt and braces: the confirm path re-checks the rule the disabled
      // action already enforces.
      if (u && u.id !== me.id) {
        u.status = 'inactive';
        R.db.upsert('users', u);
        U.toast(u.name + ' deactivated.', 'info');
      }
      closeConfirm();
      render();
    });

    // Row actions and mobile cards share one delegated handler.
    document.addEventListener('click', function (ev) {
      var node = ev.target;
      while (node && node !== document.body) {
        if (node.getAttribute) {
          if (node.getAttribute('data-off')) {
            ev.stopPropagation();
            askDeactivate(node.getAttribute('data-off'));
            return;
          }
          if (node.getAttribute('data-edit')) {
            ev.stopPropagation();
            openDrawer(node.getAttribute('data-edit'));
            return;
          }
        }
        node = node.parentNode;
      }
    });
  }

  function init() {
    R.auth.consumeWrongPortalFlag();

    renderChrome();
    renderChips();
    render();
    wire();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.RoadCrew);
