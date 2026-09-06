/* RoadCrew - js/admin/dashboard.js
   Artboard 02 (desktop) and 08 (mobile) behaviour.
   Load order: data.js, util.js, auth.js, calendar.js, dashboard.js
   -------------------------------------------------------------------------- */

window.RoadCrew = window.RoadCrew || {};

(function (R) {
  'use strict';

  var me = R.auth.requireRole('admin');
  if (!me) {
    return;
  }

  var U = R.util;
  var DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  var MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  function byId(id) { return document.getElementById(id); }

  // Pages under admin/ reach seed asset paths (which are root-relative) via '../'.
  // An uploaded check-in photo is a data URL, not a path, and must be left alone -
  // prefixing one produced '../data:image/jpeg;base64,...', which the browser then
  // requested as a URL, 404ing on every render of the check-in feed.
  function asset(path) {
    var p = String(path || '');
    if (p === '') { return ''; }
    if (p.indexOf('data:') === 0) { return p; }
    return '../' + p;
  }

  // Light tint of a brand colour, matching the canvas event-chip treatment.
  function tint(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length !== 6) {
      return 'var(--surface-alt)';
    }
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',.07)';
  }

  /* ------------------------------------------------------------- window -- */

  // Monday-to-Sunday week containing today, matching the canvas strip.
  function weekWindow() {
    var today = U.fromISO(U.todayISO());
    var dow = today.getDay();            // 0 = Sunday
    var back = dow === 0 ? 6 : dow - 1;  // Monday is the anchor
    var start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    var days = [];
    var i;
    for (i = 0; i < 7; i++) {
      days.push(U.toISO(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
    }
    return days;
  }

  // Everything the coordinator can still act on.
  function live(schedules) {
    var out = [];
    var i;
    for (i = 0; i < schedules.length; i++) {
      if (U.deriveStatus(schedules[i]) !== 'cancelled') {
        out.push(schedules[i]);
      }
    }
    return out;
  }

  // The "This week" panel and its KPI show only what is still actionable -
  // planned or ongoing. Derived from the canvas, not assumed: on the artboard's
  // own date (Sat 5 Sep) this rule is what yields its "2" and its empty Monday,
  // because the Jasmine 27-31 Aug run had already completed.
  function actionable(schedules) {
    var out = [];
    var i;
    for (i = 0; i < schedules.length; i++) {
      var st = U.deriveStatus(schedules[i]);
      if (st === 'planned' || st === 'ongoing') {
        out.push(schedules[i]);
      }
    }
    return out;
  }

  function covers(schedule, iso) {
    return schedule.startDate <= iso && iso <= schedule.endDate;
  }

  function nameOf(collection, id) {
    var rec = R.db.byId(collection, id);
    return rec ? rec.name : '';
  }

  /* ---------------------------------------------------------------- KPI -- */

  function renderKpis(week, schedules, weekly) {
    var today = U.todayISO();
    var i, j;

    var thisWeek = [];
    for (i = 0; i < weekly.length; i++) {
      if (U.overlaps(weekly[i].startDate, weekly[i].endDate, week[0], week[6])) {
        thisWeek.push(weekly[i]);
      }
    }

    var onDuty = {};
    var dutyPairs = 0;
    for (i = 0; i < schedules.length; i++) {
      if (!covers(schedules[i], today)) { continue; }
      for (j = 0; j < schedules[i].spIds.length; j++) {
        onDuty[schedules[i].spIds[j]] = true;
        dutyPairs++;
      }
    }

    // Count duty pairs that have a photo, not check-ins dated today.
    // Counting raw check-ins let the tile read 2 / 1 - a photo against a schedule
    // that does not cover today still counted, and a promoter who uploaded twice
    // counted twice, so the figure could exceed the number of people on duty.
    var checkins = R.db.checkins();
    var doneToday = 0;
    for (i = 0; i < schedules.length; i++) {
      if (!covers(schedules[i], today)) { continue; }
      for (j = 0; j < schedules[i].spIds.length; j++) {
        var k;
        for (k = 0; k < checkins.length; k++) {
          if (checkins[k].date === today &&
              checkins[k].userId === schedules[i].spIds[j] &&
              checkins[k].scheduleId === schedules[i].id) {
            doneToday++;
            break;
          }
        }
      }
    }

    var unassigned = [];
    for (i = 0; i < schedules.length; i++) {
      if (!schedules[i].spIds.length) { unassigned.push(schedules[i]); }
    }

    var dutyNames = [];
    var users = R.db.users();
    for (i = 0; i < users.length; i++) {
      if (onDuty[users[i].id]) { dutyNames.push(users[i].name); }
    }

    var firstUn = unassigned[0];
    var unSub = firstUn
      ? nameOf('outlets', firstUn.outletId) + ' · ' + U.fmtRange(firstUn.startDate, firstUn.endDate).replace(/ \d{4}$/, '')
      : 'None';

    var missing = dutyPairs - doneToday;

    byId('kpi-row').innerHTML =
      kpi('Events this week', thisWeek.length,
          'Mon ' + U.fmtDayMon(week[0]) + ' – Sun ' + U.fmtDayMon(week[6]), false) +
      kpi('Promoters on duty today', dutyNames.length,
          dutyNames.length ? dutyNames.join(' · ') : 'Nobody scheduled', false) +
      kpi('Check-ins today', doneToday + ' / ' + dutyPairs,
          missing > 0 ? missing + (missing === 1 ? ' photo' : ' photos') + ' still missing' : 'All in',
          missing > 0) +
      kpi('Unassigned slots', unassigned.length, unSub, unassigned.length > 0);
  }

  function kpi(label, value, sub, alert) {
    return '<div class="kpi' + (alert ? ' kpi-alert' : '') + '">' +
             '<div class="kpi-label">' + U.escapeHtml(label) + '</div>' +
             '<div class="kpi-value">' + U.escapeHtml(String(value)) + '</div>' +
             '<div class="kpi-sub">' + U.escapeHtml(sub) + '</div>' +
           '</div>';
  }

  /* -------------------------------------------------------- this week ---- */

  function renderWeek(week, schedules) {
    var today = U.todayISO();
    var head = '';
    var lanes = '';
    var i, j;

    for (i = 0; i < 7; i++) {
      var iso = week[i];
      var d = U.fromISO(iso);
      var isToday = iso === today;
      head += '<div class="week-day' + (isToday ? ' is-today' : '') + '">' +
                '<div class="week-dow">' + DOW[i] + '</div>' +
                '<div class="week-num">' + d.getDate() + '</div>' +
              '</div>';

      var chips = '';
      for (j = 0; j < schedules.length; j++) {
        if (!covers(schedules[j], iso)) { continue; }
        chips += eventChip(schedules[j]);
      }
      lanes += '<div class="week-lane' + (isToday ? ' is-today' : '') + '">' + chips + '</div>';
    }

    byId('week-head').innerHTML = head;
    byId('week-lanes').innerHTML = lanes;

    // Mobile replacement list (artboard 08)
    var seen = {};
    var rows = '';
    for (i = 0; i < 7; i++) {
      for (j = 0; j < schedules.length; j++) {
        var s = schedules[j];
        if (!covers(s, week[i]) || seen[s.id]) { continue; }
        seen[s.id] = true;
        rows += mweekRow(s);
      }
    }
    byId('mweek').innerHTML = rows ||
      '<div class="empty"><div class="empty-text">No events this week.</div></div>';
  }

  // Short outlet label, as the canvas used ("Econjaya", "St. Rosyam")
  function shortOutlet(name) {
    var parts = String(name).split(' ');
    return parts.length > 1 && parts[0].length <= 3 ? parts[0] + ' ' + parts[1] : parts[0];
  }

  function eventChip(s) {
    var brand = R.db.byId('brands', s.brandId);
    var color = brand ? brand.color : '#647082';
    var who = s.spIds.length ? nameOf('users', s.spIds[0]) : 'Unassigned';
    return '<button class="ev" type="button" data-id="' + U.escapeHtml(s.id) + '"' +
             ' style="--ev-color:' + color + ';--ev-tint:' + tint(color) + '">' +
             '<div class="ev-name">' + U.escapeHtml(shortOutlet(nameOf('outlets', s.outletId))) + '</div>' +
             '<div class="ev-who">' + U.escapeHtml(who) + '</div>' +
           '</button>';
  }

  function mweekRow(s) {
    var brand = R.db.byId('brands', s.brandId);
    var color = brand ? brand.color : '#647082';
    var start = U.fromISO(s.startDate);
    var end = U.fromISO(s.endDate);
    var day = start.getDate() + (s.startDate === s.endDate ? '' : '–' + end.getDate());
    var who = s.spIds.length ? nameOf('users', s.spIds[0]) : 'Unassigned';
    var status = U.deriveStatus(s);

    return '<button class="mweek-row" type="button" data-id="' + U.escapeHtml(s.id) + '"' +
             ' style="--ev-color:' + color + ';--ev-tint:' + tint(color) + '">' +
             '<div class="mweek-date">' +
               '<div class="mweek-day">' + day + '</div>' +
               '<div class="mweek-mon">' + MON[start.getMonth()] + '</div>' +
             '</div>' +
             '<div class="mweek-body">' +
               '<div class="mweek-name">' + U.escapeHtml(nameOf('outlets', s.outletId)) + '</div>' +
               '<div class="mweek-meta">' + U.escapeHtml(who + ' · ' + (brand ? brand.name : '')) + '</div>' +
             '</div>' +
             '<span class="badge badge-' + status + '">' + status.charAt(0).toUpperCase() + status.slice(1) + '</span>' +
           '</button>';
  }

  /* ------------------------------------------------------ today's feed --- */

  function renderFeed(schedules) {
    var today = U.todayISO();
    var checkins = R.db.checkins();
    var rows = [];
    var i, j, k;

    for (i = 0; i < schedules.length; i++) {
      if (!covers(schedules[i], today)) { continue; }
      for (j = 0; j < schedules[i].spIds.length; j++) {
        var user = R.db.byId('users', schedules[i].spIds[j]);
        if (!user) { continue; }
        var hit = null;
        for (k = 0; k < checkins.length; k++) {
          if (checkins[k].date === today &&
              checkins[k].userId === user.id &&
              checkins[k].scheduleId === schedules[i].id) {
            hit = checkins[k];
            break;
          }
        }
        rows.push(feedRow(user, schedules[i], hit));
      }
    }

    byId('feed').innerHTML = rows.length
      ? rows.join('<div class="feed-sep"></div>')
      : '<div class="empty"><div class="empty-text">Nobody is on duty today.</div></div>';
  }

  function feedRow(user, schedule, checkin) {
    var right = checkin
      ? '<img class="feed-thumb" src="' + U.escapeHtml(asset(checkin.photo)) + '" alt="">' +
        '<div class="feed-time">' + U.escapeHtml(checkin.time) + '</div>'
      : '<span class="badge badge-cancelled">No photo yet</span>';

    return '<div class="feed-row">' +
             '<img class="feed-avatar" src="' + U.escapeHtml(asset(user.avatar)) + '" alt="">' +
             '<div class="feed-who">' +
               '<div class="feed-name">' + U.escapeHtml(user.name) + '</div>' +
               '<div class="feed-place">' + U.escapeHtml(nameOf('outlets', schedule.outletId)) + '</div>' +
             '</div>' + right +
           '</div>';
  }

  /* --------------------------------------------------- region coverage --- */

  function renderRegions(schedules) {
    var today = U.fromISO(U.todayISO());
    var y = today.getFullYear();
    var m = today.getMonth();
    // Grouped by SUB-region, which is the level the old flat regions became and
    // therefore the level this table has always really reported. Rolling up to
    // the three new top-level regions would give three rows where there are
    // seven, and hide the East Coast inside West Malaysia.
    var regions = R.db.subregions();
    var outlets = R.db.outlets();
    var outletRegion = {};
    var i, j, k;

    for (i = 0; i < outlets.length; i++) {
      outletRegion[outlets[i].id] = outlets[i].subregionId;
    }

    var html = '<div class="grid-th">Region</div><div class="grid-th">Events</div>' +
               '<div class="grid-th">Duty-days</div><div class="grid-th">Promoters</div>';

    for (i = 0; i < regions.length; i++) {
      var events = 0;
      var dutyDays = 0;
      var promoters = {};

      for (j = 0; j < schedules.length; j++) {
        var s = schedules[j];
        if (outletRegion[s.outletId] !== regions[i].id) { continue; }
        var days = U.daysBetween(s.startDate, s.endDate);
        var inMonth = 0;
        for (k = 0; k < days.length; k++) {
          var d = U.fromISO(days[k]);
          if (d.getFullYear() === y && d.getMonth() === m) { inMonth++; }
        }
        if (!inMonth) { continue; }
        events++;
        dutyDays += inMonth;
        for (k = 0; k < s.spIds.length; k++) { promoters[s.spIds[k]] = true; }
      }

      var count = 0;
      for (var key in promoters) {
        if (Object.prototype.hasOwnProperty.call(promoters, key)) { count++; }
      }

      html += '<div class="grid-td">' + U.escapeHtml(regions[i].name) + '</div>' +
              '<div class="grid-td">' + events + '</div>' +
              '<div class="grid-td">' + dutyDays + '</div>' +
              '<div class="grid-td">' + count + '</div>';
    }

    byId('region-table').innerHTML = html;
  }

  /* --------------------------------------------------------------- chrome */

  function renderChrome() {
    var today = U.fromISO(U.todayISO());
    var full = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][today.getDay()] +
               ', ' + U.fmtDate(U.todayISO());
    var short = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][today.getDay()] +
                ', ' + U.fmtDayMon(U.todayISO());

    byId('topbar-date').textContent = full;
    byId('appbar-date').textContent = short;
    byId('topbar-initial').textContent = U.initials(me.name);
    byId('appbar-initial').textContent = U.initials(me.name);
    byId('side-initial').textContent = U.initials(me.name);
    byId('side-name').textContent = me.name;
  }

  function wire() {
    var outs = document.querySelectorAll('[data-logout]');
    var i;
    for (i = 0; i < outs.length; i++) {
      outs[i].addEventListener('click', function () { R.auth.logout(); });
    }

    document.addEventListener('click', function (ev) {
      var node = ev.target;
      while (node && node !== document.body) {
        if (node.getAttribute && node.getAttribute('data-id')) {
          window.location.href = 'schedules.html?id=' + encodeURIComponent(node.getAttribute('data-id'));
          return;
        }
        node = node.parentNode;
      }
    });
  }

  function init() {
    R.auth.consumeWrongPortalFlag();

    var all = R.db.schedules();
    var schedules = live(all);
    var week = weekWindow();

    renderChrome();
    renderKpis(week, schedules, actionable(all));
    renderWeek(week, actionable(all));
    renderFeed(schedules);
    renderRegions(schedules);
    wire();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.RoadCrew);
