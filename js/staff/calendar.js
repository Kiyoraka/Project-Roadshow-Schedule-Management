/* RoadCrew - js/staff/calendar.js
   Artboard 05 (Staff My Calendar): today card, month grid, upcoming list.
   Load order: data.js, util.js, auth.js, calendar.js, staff/calendar.js
   -------------------------------------------------------------------------- */

window.RoadCrew = window.RoadCrew || {};

(function (R) {
  'use strict';

  var me = R.auth.requireRole('staff');
  if (!me) {
    return;
  }

  R.auth.consumeWrongPortalFlag();

  var U = R.util;

  // Middle dot (U+00B7), written as an escape so file encoding cannot break it.
  var MID = '\u00b7';

  var MONTHS_UP = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                   'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  var view = { year: 0, month: 0 };

  function byId(id) { return document.getElementById(id); }
  function asset(p) { return '../' + String(p || ''); }

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

  /* ---------------------------------------------------------------- data -- */

  // Every schedule I am rostered on. A cancelled event disappears from the
  // promoter's view entirely - section 6, and the admin cancel copy says so.
  function mySchedules() {
    var all = R.db.schedules();
    var out = [];
    var i;
    for (i = 0; i < all.length; i++) {
      var s = all[i];
      if (!s || !s.spIds) { continue; }
      if (s.spIds.indexOf(me.id) === -1) { continue; }
      if (U.deriveStatus(s) === 'cancelled') { continue; }
      out.push(s);
    }
    return out;
  }

  function myCheckins() {
    var all = R.db.checkins();
    var out = [];
    var i;
    for (i = 0; i < all.length; i++) {
      if (all[i] && all[i].userId === me.id) { out.push(all[i]); }
    }
    return out;
  }

  function checkinOn(iso) {
    var mine = myCheckins();
    var i;
    for (i = 0; i < mine.length; i++) {
      if (mine[i].date === iso) { return mine[i]; }
    }
    return null;
  }

  function brandBadge(brandId) {
    var b = R.db.byId('brands', brandId);
    if (!b) { return ''; }
    return '<span class="badge badge-brand" style="--brand-tint:' + tint(b.color) +
           ';--brand-ink:' + b.color + '">' + U.escapeHtml(b.name) + '</span>';
  }

  function eventHref(id) {
    return 'event.html?id=' + encodeURIComponent(id);
  }

  /* ---------------------------------------------------------- today card -- */

  function todaySchedule(rows, today) {
    var i;
    for (i = 0; i < rows.length; i++) {
      if (rows[i].startDate <= today && today <= rows[i].endDate) { return rows[i]; }
    }
    return null;
  }

  function renderToday(rows) {
    var slot = byId('today-slot');
    var today = U.todayISO();
    var s = todaySchedule(rows, today);

    // No duty today - the artboard simply drops the card.
    if (!s) {
      slot.innerHTML = '';
      return;
    }

    var outlet = R.db.byId('outlets', s.outletId);
    var meta = (outlet ? outlet.city : '') + ' ' + MID + ' ' + s.shift;
    var done = checkinOn(today);
    var href = U.escapeHtml(eventHref(s.id));

    var html =
      '<div class="today-card">' +
        '<div class="today-top">' +
          brandBadge(s.brandId) +
          '<span class="today-flag">Today</span>' +
        '</div>' +
        '<div class="today-name">' + U.escapeHtml(outlet ? outlet.name : '') + '</div>';

    if (done) {
      html +=
        '<div class="today-meta today-meta-tight">' + U.escapeHtml(meta) + '</div>' +
        '<div class="today-done">&#10003; Checked in at ' + U.escapeHtml(done.time) + '</div>' +
        '<a class="btn btn-block btn-tall" href="' + href + '">Add another photo</a>';
    } else {
      html +=
        '<div class="today-meta">' + U.escapeHtml(meta) + '</div>' +
        '<a class="btn btn-primary btn-block btn-tall" href="' + href + '">Check in with photo</a>';
    }

    slot.innerHTML = html + '</div>';
  }

  /* --------------------------------------------------------- month grid -- */

  function renderGrid(rows) {
    var events = [];
    var checks = [];
    var mine = myCheckins();
    var i;

    for (i = 0; i < rows.length; i++) {
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

    for (i = 0; i < mine.length; i++) {
      if (checks.indexOf(mine[i].date) === -1) { checks.push(mine[i].date); }
    }

    byId('m-label').textContent = R.calendar.monthLabel(view.year, view.month);

    R.calendar.renderMonth(byId('m-grid'), {
      year: view.year,
      month: view.month,
      mode: 'staff',
      weekStart: 1,
      fillAdjacent: true,
      dayLabels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
      checks: checks,
      events: events,
      onEventClick: function (id) {
        window.location.href = 'event.html?id=' + encodeURIComponent(id);
      }
    });
  }

  /* ------------------------------------------------------------ upcoming -- */

  // '5' for a single day, '4-5' for a run.
  // Artboard 05 shows a bare "5" for the Econjaya run of 4-5 Sep when viewed on
  // the 5th, not "4-5". So a run already under way reports the day still to work;
  // only a run that has not started yet shows its full span.
  // The date the row reports from - today for a run already under way.
  function labelFrom(s) {
    var today = U.todayISO();
    return s.startDate < today ? today : s.startDate;
  }

  function dayLabel(s) {
    var from = labelFrom(s);
    var start = parseInt(String(from).split('-')[2], 10);
    var end = parseInt(String(s.endDate).split('-')[2], 10);
    if (from === s.endDate || start === end) { return String(start); }
    return start + '-' + end;
  }

  function monLabel(iso) {
    var m = parseInt(String(iso).split('-')[1], 10);
    return MONTHS_UP[m - 1] || '';
  }

  // Duty days still ahead inside the month on screen. The artboard's note reads
  // "No more duty days this month", so today itself does not count as more.
  function remainingThisMonth(rows) {
    var today = U.todayISO();
    var prefix = view.year + '-' + (view.month + 1 < 10 ? '0' : '') + (view.month + 1) + '-';
    var i, j;

    for (i = 0; i < rows.length; i++) {
      var days = U.daysBetween(rows[i].startDate, rows[i].endDate);
      for (j = 0; j < days.length; j++) {
        if (days[j] > today && days[j].indexOf(prefix) === 0) { return true; }
      }
    }
    return false;
  }

  function renderUpcoming(rows) {
    var today = U.todayISO();
    var soon = [];
    var html = '';
    var i;

    for (i = 0; i < rows.length; i++) {
      if (rows[i].endDate >= today) { soon.push(rows[i]); }
    }

    soon.sort(function (a, b) {
      if (a.startDate !== b.startDate) { return a.startDate < b.startDate ? -1 : 1; }
      return a.id < b.id ? -1 : 1;
    });

    for (i = 0; i < soon.length; i++) {
      var s = soon[i];
      html +=
        '<a class="up-row" href="' + U.escapeHtml(eventHref(s.id)) + '">' +
          '<div class="up-date">' +
            '<div class="up-day">' + U.escapeHtml(dayLabel(s)) + '</div>' +
            '<div class="up-mon">' + U.escapeHtml(monLabel(labelFrom(s))) + '</div>' +
          '</div>' +
          '<div class="up-div"></div>' +
          '<div class="up-body">' +
            '<div class="up-name">' + U.escapeHtml(nameOf('outlets', s.outletId)) + '</div>' +
            '<div class="up-time">' + U.escapeHtml(s.shift) + '</div>' +
          '</div>' +
          brandBadge(s.brandId) +
        '</a>';
    }

    byId('up-list').innerHTML = html;

    var empty = byId('up-empty');
    if (remainingThisMonth(rows)) {
      empty.textContent = '';
      empty.hidden = true;
    } else {
      empty.textContent = 'No more duty days this month';
      empty.hidden = false;
    }
  }

  /* -------------------------------------------------------------- chrome -- */

  function renderChrome() {
    byId('s-avatar').src = asset(me.avatar);
    byId('s-avatar').alt = me.name;
    byId('s-name').textContent = me.name;
    byId('s-sub').textContent = nameOf('regions', me.regionId);

    byId('p-name').textContent = me.name;
    byId('p-email').textContent = me.email;
    byId('p-region').textContent = nameOf('regions', me.regionId);
  }

  function openProfile() {
    byId('profile').className = 'modal is-open';
  }

  function closeProfile() {
    byId('profile').className = 'modal';
  }

  function render() {
    var rows = mySchedules();
    renderToday(rows);
    renderGrid(rows);
    renderUpcoming(rows);
  }

  function on(id, event, fn) {
    var el = byId(id);
    if (el) { el.addEventListener(event, fn); }
  }

  function wire() {
    var outs = document.querySelectorAll('[data-logout]');
    var i;
    for (i = 0; i < outs.length; i++) {
      outs[i].addEventListener('click', function () { R.auth.logout(); });
    }

    on('nav-profile', 'click', openProfile);
    on('p-close', 'click', closeProfile);

    // Tapping the scrim outside the box dismisses the sheet.
    on('profile', 'click', function (ev) {
      if (ev.target === this) { closeProfile(); }
    });

    on('m-prev', 'click', function () {
      view = R.calendar.prevMonth(view.year, view.month);
      renderGrid(mySchedules());
      renderUpcoming(mySchedules());
    });
    on('m-next', 'click', function () {
      view = R.calendar.nextMonth(view.year, view.month);
      renderGrid(mySchedules());
      renderUpcoming(mySchedules());
    });
  }

  function init() {
    var today = U.fromISO(U.todayISO());
    view = { year: today.getFullYear(), month: today.getMonth() };

    renderChrome();
    render();
    wire();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.RoadCrew);
