/* RoadCrew - js/staff/uploads.js
   Artboard 07 (My Uploads): the promoter's own check-in photos, grouped by
   calendar month, newest month first.
   Load order: data.js, util.js, auth.js, uploads.js
   -------------------------------------------------------------------------- */

window.RoadCrew = window.RoadCrew || {};

(function (R) {
  'use strict';

  var me = R.auth.requireRole('staff');
  if (!me) {
    return;
  }

  var U = R.util;

  // Names only - the ORDER of the groups is derived from the dates, never from
  // this list, so a promoter with an October upload still sorts correctly.
  var MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

  function byId(id) { return document.getElementById(id); }
  // Seed photos are root-relative paths; an uploaded photo is a data URL and must
  // be passed through untouched, or it becomes '../data:image/...' and 404s.
  function asset(p) {
    var v = String(p || '');
    if (v === '') { return ''; }
    if (v.indexOf('data:') === 0) { return v; }
    return '../' + v;
  }

  function nameOf(collection, id) {
    var rec = R.db.byId(collection, id);
    return rec ? rec.name : '';
  }

  // '2026-09-05' -> '2026-09', the bucket key for a check-in date.
  function monthKey(iso) {
    return String(iso || '').slice(0, 7);
  }

  // '2026-09' -> 'September 2026'
  function monthTitle(key) {
    var parts = String(key).split('-');
    var m = parseInt(parts[1], 10);
    return (MONTHS_FULL[m - 1] || '') + ' ' + parts[0];
  }

  /* ---------------------------------------------------------------- data -- */

  // Only this promoter's own check-ins.
  function mine() {
    var all = R.db.checkins();
    var out = [];
    var i;
    for (i = 0; i < all.length; i++) {
      if (all[i] && all[i].userId === me.id) {
        out.push(all[i]);
      }
    }
    return out;
  }

  // Newest photo first: date, then time, then id as a stable tie-break.
  function newestFirst(a, b) {
    if (a.date !== b.date) { return a.date < b.date ? 1 : -1; }
    var at = String(a.time || '');
    var bt = String(b.time || '');
    if (at !== bt) { return at < bt ? 1 : -1; }
    return a.id < b.id ? 1 : -1;
  }

  // [{ key: '2026-09', rows: [...] }, ...] - newest month first.
  function groupByMonth(rows) {
    var buckets = {};
    var keys = [];
    var i;

    for (i = 0; i < rows.length; i++) {
      var key = monthKey(rows[i].date);
      if (!Object.prototype.hasOwnProperty.call(buckets, key)) {
        buckets[key] = [];
        keys.push(key);
      }
      buckets[key].push(rows[i]);
    }

    keys.sort(function (a, b) {
      if (a === b) { return 0; }
      return a < b ? 1 : -1;
    });

    var out = [];
    for (i = 0; i < keys.length; i++) {
      buckets[keys[i]].sort(newestFirst);
      out.push({ key: keys[i], rows: buckets[keys[i]] });
    }
    return out;
  }

  /* -------------------------------------------------------------- render -- */

  function tile(row) {
    var schedule = R.db.byId('schedules', row.scheduleId);
    var outlet = schedule ? nameOf('outlets', schedule.outletId) : '';
    var href = 'event.html?id=' + encodeURIComponent(String(row.scheduleId || ''));

    // The <br> is our markup; the outlet name is escaped content around it.
    return '<a href="' + U.escapeHtml(href) + '">' +
           '<img class="tile-img" src="' + U.escapeHtml(asset(row.photo)) + '" alt="">' +
           '<div class="tile-cap">' + U.escapeHtml(outlet) + '<br>' +
           U.escapeHtml(U.fmtDayMon(row.date)) + '</div>' +
           '</a>';
  }

  function renderGroups(groups) {
    var host = byId('groups');
    if (!host) { return; }

    if (!groups.length) {
      host.innerHTML =
        '<div class="empty">' +
        '<div class="empty-text">No photos uploaded yet.</div>' +
        '<a class="btn" href="calendar.html">Go to my calendar</a>' +
        '</div>';
      return;
    }

    var html = '';
    var i;
    var j;
    for (i = 0; i < groups.length; i++) {
      html += '<div class="up-month">' + U.escapeHtml(monthTitle(groups[i].key)) + '</div>';
      html += '<div class="tile-grid">';
      for (j = 0; j < groups[i].rows.length; j++) {
        html += tile(groups[i].rows[j]);
      }
      html += '</div>';
    }
    host.innerHTML = html;
  }

  function renderHeader(total) {
    var avatar = byId('avatar');
    if (avatar) {
      avatar.src = asset(me.avatar);
      avatar.alt = me.name;
    }
    var count = byId('count');
    if (count) {
      count.textContent = total + (total === 1 ? ' photo' : ' photos');
    }
  }

  /* ------------------------------------------------------------- profile -- */

  function renderProfile() {
    var name = byId('profile-name');
    var email = byId('profile-email');
    var region = byId('profile-region');
    if (name) { name.textContent = me.name; }
    if (email) { email.textContent = me.email; }
    if (region) { region.textContent = nameOf('subregions', me.subregionId) || 'No region'; }
  }

  function openProfile() {
    byId('profile').className = 'modal is-open';
  }

  function closeProfile() {
    byId('profile').className = 'modal';
  }

  /* ---------------------------------------------------------------- wire -- */

  function on(id, event, fn) {
    var el = byId(id);
    if (el) { el.addEventListener(event, fn); }
  }

  function wire() {
    on('profile-close', 'click', closeProfile);

    var modal = byId('profile');
    if (modal) {
      modal.addEventListener('click', function (ev) {
        if (ev.target === modal) { closeProfile(); }
      });
    }

    // Log out buttons (header and profile sheet) plus the profile nav item
    // share one delegated handler.
    document.addEventListener('click', function (ev) {
      var node = ev.target;
      while (node && node !== document.body) {
        if (node.getAttribute) {
          if (node.getAttribute('data-logout') !== null) {
            ev.preventDefault();
            R.auth.logout();
            return;
          }
          if (node.getAttribute('data-profile') !== null) {
            ev.preventDefault();
            openProfile();
            return;
          }
        }
        node = node.parentNode;
      }
    });
  }

  function init() {
    R.auth.consumeWrongPortalFlag();

    var rows = mine();
    renderHeader(rows.length);
    renderGroups(groupByMonth(rows));
    renderProfile();
    wire();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.RoadCrew);
