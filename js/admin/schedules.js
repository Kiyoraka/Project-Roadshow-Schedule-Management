/* RoadCrew - js/admin/schedules.js
   Artboards 03 (desktop table), 09 (mobile cards) and 04 (drawer with conflict).
   Load order: data.js, util.js, auth.js, calendar.js, schedules.js
   -------------------------------------------------------------------------- */

window.RoadCrew = window.RoadCrew || {};

(function (R) {
  'use strict';

  var me = R.auth.requireRole('admin');
  if (!me) {
    return;
  }

  var U = R.util;

  var view = 'list';
  var draft = null;          // schedule being created or edited
  var pending = null;        // id queued for cancellation
  var month = { year: 0, m: 0 };

  function byId(id) { return document.getElementById(id); }
  function asset(p) { return '../' + String(p || ''); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function tint(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length !== 6) { return 'var(--line-soft)'; }
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' +
                     parseInt(h.slice(2, 4), 16) + ',' +
                     parseInt(h.slice(4, 6), 16) + ',.10)';
  }

  function nameOf(collection, id) {
    var rec = R.db.byId(collection, id);
    return rec ? rec.name : '';
  }

  function regionOfOutlet(outletId) {
    var o = R.db.byId('outlets', outletId);
    return o ? o.regionId : null;
  }

  /* -------------------------------------------------------------- filter -- */

  function fillSelect(el, label, rows) {
    var html = '<option value="">' + label + ': All</option>';
    var i;
    for (i = 0; i < rows.length; i++) {
      html += '<option value="' + U.escapeHtml(rows[i].id) + '">' +
              U.escapeHtml(rows[i].name) + '</option>';
    }
    el.innerHTML = html;
  }

  function buildFilters() {
    fillSelect(byId('f-brand'), 'Brand', R.db.brands());
    fillSelect(byId('f-region'), 'Region', R.db.regions());

    var staff = [];
    var users = R.db.users();
    var i;
    for (i = 0; i < users.length; i++) {
      if (users[i].role === 'staff') { staff.push(users[i]); }
    }
    fillSelect(byId('f-promoter'), 'Promoter', staff);

    fillSelect(byId('f-status'), 'Status', [
      { id: 'planned', name: 'Planned' },
      { id: 'ongoing', name: 'Ongoing' },
      { id: 'completed', name: 'Completed' },
      { id: 'cancelled', name: 'Cancelled' }
    ]);
  }

  function filtered() {
    var brand = byId('f-brand').value;
    var region = byId('f-region').value;
    var promoter = byId('f-promoter').value;
    var status = byId('f-status').value;

    var all = R.db.schedules();
    var out = [];
    var i;

    for (i = 0; i < all.length; i++) {
      var s = all[i];
      if (brand && s.brandId !== brand) { continue; }
      if (region && regionOfOutlet(s.outletId) !== region) { continue; }
      if (promoter && s.spIds.indexOf(promoter) === -1) { continue; }
      if (status && U.deriveStatus(s) !== status) { continue; }
      out.push(s);
    }

    // Canvas footer: "sorted by start date, newest first"
    out.sort(function (a, b) {
      if (a.startDate === b.startDate) { return a.id < b.id ? 1 : -1; }
      return a.startDate < b.startDate ? 1 : -1;
    });
    return out;
  }

  /* ---------------------------------------------------------------- list -- */

  function brandBadge(s) {
    var b = R.db.byId('brands', s.brandId);
    if (!b) { return ''; }
    return '<span class="badge badge-brand" style="--brand-tint:' + tint(b.color) +
           ';--brand-ink:' + b.color + '">' + U.escapeHtml(b.name) + '</span>';
  }

  function statusBadge(s) {
    var st = U.deriveStatus(s);
    return '<span class="badge badge-' + st + '">' + cap(st) + '</span>';
  }

  function peopleCell(s) {
    if (!s.spIds.length) {
      return '<span class="badge badge-cancelled">Unassigned</span>';
    }
    var faces = '';
    var names = [];
    var i;
    for (i = 0; i < s.spIds.length; i++) {
      var u = R.db.byId('users', s.spIds[i]);
      if (!u) { continue; }
      faces += '<img class="sched-face" src="' + U.escapeHtml(asset(u.avatar)) + '" alt="">';
      names.push(u.name);
    }
    return '<div class="sched-people"><div class="sched-stack">' + faces + '</div>' +
           '<span class="sched-names">' + U.escapeHtml(names.join(', ')) + '</span></div>';
  }

  function renderList() {
    var rows = filtered();
    var total = R.db.schedules().length;
    var today = U.todayISO();
    var htmlRows = '';
    var htmlCards = '';
    var i;

    for (i = 0; i < rows.length; i++) {
      var s = rows[i];
      var st = U.deriveStatus(s);
      var cancelled = st === 'cancelled';
      var current = st === 'ongoing';
      var cls = 'sched-cols sched-row' +
                (cancelled ? ' is-cancelled' : '') +
                (current ? ' is-current' : '');

      htmlRows +=
        '<div class="' + cls + '" data-id="' + U.escapeHtml(s.id) + '">' +
          '<div class="sched-dates">' + U.escapeHtml(shortRange(s)) + '</div>' +
          '<div>' + brandBadge(s) + '</div>' +
          '<div>' + U.escapeHtml(nameOf('outlets', s.outletId)) + '</div>' +
          '<div class="sched-dim">' + U.escapeHtml(nameOf('regions', regionOfOutlet(s.outletId))) + '</div>' +
          '<div>' + peopleCell(s) + '</div>' +
          '<div class="sched-dim">' + U.escapeHtml(s.shift) + '</div>' +
          '<div>' + statusBadge(s) + '</div>' +
          '<div class="sched-actions">' +
            (cancelled ? '<span>&#9998;</span><span>&#10005;</span>'
                       : '<button class="sched-act" type="button" data-edit="' + U.escapeHtml(s.id) + '" title="Edit">&#9998;</button>' +
                         '<button class="sched-act" type="button" data-cancel="' + U.escapeHtml(s.id) + '" title="Cancel">&#10005;</button>') +
          '</div>' +
        '</div>';

      // Mobile card (artboard 09). A cancelled card shows its note in place of
      // the shift and drops the promoter row, exactly as the artboard does.
      var meta = shortRange(s) + ' · ' + nameOf('regions', regionOfOutlet(s.outletId)) +
                 ' · ' + (cancelled ? (s.notes || 'Cancelled') : s.shift);
      var who = '';
      if (!cancelled) {
        if (!s.spIds.length) {
          who = '<span class="badge badge-cancelled">Unassigned</span>';
        } else {
          var u2 = R.db.byId('users', s.spIds[0]);
          var extra = s.spIds.length > 1 ? ' +' + (s.spIds.length - 1) : '';
          who = '<div class="sched-card-who">' +
                  '<img class="sched-card-face" src="' + U.escapeHtml(asset(u2 ? u2.avatar : '')) + '" alt="">' +
                  '<span class="sched-card-whoname">' + U.escapeHtml((u2 ? u2.name : '') + extra) + '</span>' +
                '</div>';
        }
      }

      htmlCards +=
        '<button class="sched-card' + (cancelled ? ' is-cancelled' : '') +
          (current ? ' is-current' : '') + '" type="button" data-id="' + U.escapeHtml(s.id) + '">' +
          '<div class="sched-card-top">' + brandBadge(s) + statusBadge(s) + '</div>' +
          '<div class="sched-card-name">' + U.escapeHtml(nameOf('outlets', s.outletId)) + '</div>' +
          '<div class="sched-card-meta">' + U.escapeHtml(meta) + '</div>' + who +
        '</button>';
    }

    byId('sched-rows').innerHTML = htmlRows ||
      '<div class="empty"><div class="empty-text">No schedules match these filters.</div></div>';
    byId('sched-cards').innerHTML = htmlCards ||
      '<div class="empty"><div class="empty-text">No schedules match these filters.</div></div>';
    byId('sched-foot').textContent =
      'Showing ' + rows.length + ' of ' + total + ' schedules · sorted by start date, newest first';

    if (today) { /* today drives deriveStatus above */ }
  }

  // '19-20 Sep' | '12 Sep' | '30 Jul - 1 Aug'  (year dropped, as the table does)
  function shortRange(s) {
    return U.fmtRange(s.startDate, s.endDate).replace(/ \d{4}$/, '');
  }

  /* --------------------------------------------------------------- month -- */

  function renderMonth() {
    var rows = filtered();
    var events = [];
    var i;
    for (i = 0; i < rows.length; i++) {
      if (U.deriveStatus(rows[i]) === 'cancelled') { continue; }
      var b = R.db.byId('brands', rows[i].brandId);
      events.push({
        id: rows[i].id,
        startDate: rows[i].startDate,
        endDate: rows[i].endDate,
        color: b ? b.color : '#647082',
        label: nameOf('outlets', rows[i].outletId),
        dot: true
      });
    }

    byId('month-label').textContent = R.calendar.monthLabel(month.year, month.m);
    R.calendar.renderMonth(byId('month-grid'), {
      year: month.year,
      month: month.m,
      events: events,
      mode: 'admin',
      onEventClick: function (id) { openDrawer(id); }
    });
  }

  function setView(next) {
    view = next;
    byId('view-list').hidden = next !== 'list';
    byId('view-month').hidden = next !== 'month';
    var btns = document.querySelectorAll('[data-view]');
    var i;
    for (i = 0; i < btns.length; i++) {
      btns[i].className = 'viewseg-btn' +
        (btns[i].getAttribute('data-view') === next ? ' is-active' : '');
    }
    if (next === 'month') { renderMonth(); } else { renderList(); }
  }

  /* -------------------------------------------------------------- drawer -- */

  function blank() {
    var today = U.todayISO();
    var brands = R.db.brands();
    var regions = R.db.regions();
    return {
      id: '',
      brandId: brands.length ? brands[0].id : '',
      regionId: regions.length ? regions[0].id : '',
      outletId: '',
      spIds: [],
      startDate: today,
      endDate: today,
      shift: '10:00 – 18:00',
      status: 'planned',
      notes: ''
    };
  }

  function openDrawer(id) {
    var existing = id ? R.db.byId('schedules', id) : null;

    if (existing) {
      draft = {
        id: existing.id,
        brandId: existing.brandId,
        regionId: regionOfOutlet(existing.outletId),
        outletId: existing.outletId,
        spIds: existing.spIds.slice(),
        startDate: existing.startDate,
        endDate: existing.endDate,
        shift: existing.shift,
        status: existing.status,
        notes: existing.notes
      };
      byId('drawer-title').textContent = 'Edit schedule';
    } else {
      draft = blank();
      byId('drawer-title').textContent = 'New schedule';
    }

    fillSelect(byId('d-brand'), '', R.db.brands());
    byId('d-brand').innerHTML = optionsFor(R.db.brands(), draft.brandId);
    byId('d-region').innerHTML = optionsFor(R.db.regions(), draft.regionId);
    refreshOutlets();

    byId('d-start').value = draft.startDate;
    byId('d-end').value = draft.endDate;
    byId('d-shift').value = draft.shift;
    byId('d-notes').value = draft.notes;

    renderPromoters();

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

  function optionsFor(rows, selected) {
    var html = '';
    var i;
    for (i = 0; i < rows.length; i++) {
      html += '<option value="' + U.escapeHtml(rows[i].id) + '"' +
              (rows[i].id === selected ? ' selected' : '') + '>' +
              U.escapeHtml(rows[i].name) + '</option>';
    }
    return html;
  }

  function refreshOutlets() {
    var outlets = R.db.outlets();
    var inRegion = [];
    var i;
    for (i = 0; i < outlets.length; i++) {
      if (outlets[i].regionId === draft.regionId) { inRegion.push(outlets[i]); }
    }
    if (!inRegion.length) { inRegion = outlets; }
    var stillValid = false;
    for (i = 0; i < inRegion.length; i++) {
      if (inRegion[i].id === draft.outletId) { stillValid = true; }
    }
    if (!stillValid) { draft.outletId = inRegion[0].id; }
    byId('d-outlet').innerHTML = optionsFor(inRegion, draft.outletId);
  }

  // Every other live schedule this promoter already holds that overlaps the draft.
  function clashesFor(userId) {
    var all = R.db.schedules();
    var out = [];
    var i;
    for (i = 0; i < all.length; i++) {
      var s = all[i];
      if (s.id === draft.id) { continue; }
      if (U.deriveStatus(s) === 'cancelled') { continue; }
      if (s.spIds.indexOf(userId) === -1) { continue; }
      if (U.overlaps(draft.startDate, draft.endDate, s.startDate, s.endDate)) { out.push(s); }
    }
    return out;
  }

  function renderPromoters() {
    var users = R.db.users();
    var html = '';
    var i;

    for (i = 0; i < users.length; i++) {
      var u = users[i];
      if (u.role !== 'staff') { continue; }
      if (u.regionId !== draft.regionId) { continue; }

      var picked = draft.spIds.indexOf(u.id) !== -1;
      // Rule 9 survives: a deactivated promoter cannot be added to new work,
      // though one already attached to this schedule stays visible.
      var blocked = u.status === 'inactive' && !picked;

      var clash = clashesFor(u.id);
      var meta = nameOf('regions', u.regionId);
      if (u.status === 'inactive') { meta += ' · Inactive'; }
      if (clash.length) {
        meta += ' · Booked ' + shortRange(clash[0]);
      }

      html +=
        '<button class="pro-row' + (picked ? ' is-picked' : '') + '" type="button"' +
          ' data-pick="' + U.escapeHtml(u.id) + '"' + (blocked ? ' disabled' : '') + '>' +
          '<span class="pro-check">&#10003;</span>' +
          '<img class="pro-face" src="' + U.escapeHtml(asset(u.avatar)) + '" alt="">' +
          '<span class="pro-body">' +
            '<span class="pro-name">' + U.escapeHtml(u.name) + '</span>' +
            '<span class="pro-meta">' + U.escapeHtml(meta) + '</span>' +
          '</span>' +
        '</button>';
    }

    byId('d-promoters').innerHTML = html ||
      '<div class="empty"><div class="empty-text">No promoters in this region.</div></div>';

    refreshConflict();
  }

  function refreshConflict() {
    var messages = [];
    var i, j;

    for (i = 0; i < draft.spIds.length; i++) {
      var clash = clashesFor(draft.spIds[i]);
      for (j = 0; j < clash.length; j++) {
        // Artboard 04 names the days that actually collide, not the whole span of
        // the other booking - the promoter row above already carries that.
        var from = clash[j].startDate > draft.startDate ? clash[j].startDate : draft.startDate;
        var to = clash[j].endDate < draft.endDate ? clash[j].endDate : draft.endDate;
        messages.push(nameOf('users', draft.spIds[i]) + ' is already booked at ' +
                      nameOf('outlets', clash[j].outletId) + ' on ' +
                      U.fmtRange(from, to).replace(/ \d{4}$/, '') + '.');
      }
    }

    var box = byId('d-conflict');
    var save = byId('d-save');

    if (messages.length) {
      byId('d-conflict-text').textContent =
        messages.join(' ') + ' Saving will double-book this promoter.';
      box.hidden = false;
      save.textContent = 'Save anyway';   // warning never blocks, it relabels
    } else {
      box.hidden = true;
      save.textContent = 'Save';
    }
  }

  function saveDraft() {
    if (!draft.outletId) {
      U.toast('Pick an outlet first.', 'danger');
      return;
    }
    if (draft.endDate < draft.startDate) {
      U.toast('End date cannot be before the start date.', 'danger');
      return;
    }

    var record = {
      id: draft.id || U.uid('s'),
      brandId: draft.brandId,
      outletId: draft.outletId,
      spIds: draft.spIds.slice(),
      startDate: draft.startDate,
      endDate: draft.endDate,
      shift: draft.shift,
      status: draft.status,
      notes: draft.notes
    };

    R.db.upsert('schedules', record);
    closeDrawer();
    setView(view);
    U.toast('Schedule saved.', 'success');
  }

  /* ------------------------------------------------------------- cancel --- */

  function askCancel(id) {
    var s = R.db.byId('schedules', id);
    if (!s) { return; }
    pending = id;
    byId('confirm-text').textContent =
      nameOf('outlets', s.outletId) + ', ' + shortRange(s) +
      '. It stays visible in the list, dimmed, and disappears from promoter calendars.';
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

    var views = document.querySelectorAll('[data-view]');
    for (i = 0; i < views.length; i++) {
      views[i].addEventListener('click', function (ev) {
        setView(ev.currentTarget.getAttribute('data-view'));
      });
    }

    var filters = ['f-brand', 'f-region', 'f-promoter', 'f-status'];
    for (i = 0; i < filters.length; i++) {
      on(filters[i], 'change', function () { setView(view); });
    }

    on('btn-new', 'click', function () { openDrawer(null); });
    on('drawer-close', 'click', closeDrawer);
    on('d-cancel', 'click', closeDrawer);
    on('scrim', 'click', closeDrawer);
    on('d-save', 'click', saveDraft);

    // prevMonth/nextMonth return { year, month }; this page's state field is `m`.
    // Assigning the returned object straight into `month` left `month.m` undefined,
    // which the renderer quietly folded back to the current month - so the arrows
    // appeared to do nothing. Map the shape explicitly.
    on('month-prev', 'click', function () {
      var p = R.calendar.prevMonth(month.year, month.m);
      month = { year: p.year, m: p.month };
      renderMonth();
    });
    on('month-next', 'click', function () {
      var n = R.calendar.nextMonth(month.year, month.m);
      month = { year: n.year, m: n.month };
      renderMonth();
    });

    on('d-brand', 'change', function (ev) { draft.brandId = ev.target.value; });
    on('d-region', 'change', function (ev) {
      draft.regionId = ev.target.value;
      draft.spIds = [];
      refreshOutlets();
      renderPromoters();
    });
    on('d-outlet', 'change', function (ev) { draft.outletId = ev.target.value; });
    on('d-shift', 'change', function (ev) { draft.shift = ev.target.value; });
    on('d-notes', 'change', function (ev) { draft.notes = ev.target.value; });
    on('d-start', 'change', function (ev) {
      draft.startDate = ev.target.value;
      if (draft.endDate < draft.startDate) {
        draft.endDate = draft.startDate;
        byId('d-end').value = draft.endDate;
      }
      renderPromoters();
    });
    on('d-end', 'change', function (ev) {
      draft.endDate = ev.target.value;
      renderPromoters();
    });

    byId('d-promoters').addEventListener('click', function (ev) {
      var node = ev.target;
      while (node && node !== this) {
        if (node.getAttribute && node.getAttribute('data-pick')) {
          var id = node.getAttribute('data-pick');
          var at = draft.spIds.indexOf(id);
          if (at === -1) { draft.spIds.push(id); } else { draft.spIds.splice(at, 1); }
          renderPromoters();
          return;
        }
        node = node.parentNode;
      }
    });

    on('confirm-no', 'click', closeConfirm);
    on('confirm-yes', 'click', function () {
      var s = pending ? R.db.byId('schedules', pending) : null;
      if (s) {
        s.status = 'cancelled';
        R.db.upsert('schedules', s);
        U.toast('Schedule cancelled.', 'info');
      }
      closeConfirm();
      setView(view);
    });

    // Row, card and action clicks share one delegated handler.
    document.addEventListener('click', function (ev) {
      var node = ev.target;
      while (node && node !== document.body) {
        if (node.getAttribute) {
          if (node.getAttribute('data-cancel')) {
            ev.stopPropagation();
            askCancel(node.getAttribute('data-cancel'));
            return;
          }
          if (node.getAttribute('data-edit')) {
            ev.stopPropagation();
            openDrawer(node.getAttribute('data-edit'));
            return;
          }
          if (node.getAttribute('data-id')) {
            openDrawer(node.getAttribute('data-id'));
            return;
          }
        }
        node = node.parentNode;
      }
    });
  }

  function deepLinkId() {
    var search = String(window.location.search || '');
    var hit = /[?&]id=([^&]+)/.exec(search);
    return hit ? decodeURIComponent(hit[1]) : null;
  }

  function init() {
    R.auth.consumeWrongPortalFlag();

    var today = U.fromISO(U.todayISO());
    month = { year: today.getFullYear(), m: today.getMonth() };

    renderChrome();
    buildFilters();
    setView('list');
    wire();

    var id = deepLinkId();
    if (id && R.db.byId('schedules', id)) {
      openDrawer(id);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.RoadCrew);
