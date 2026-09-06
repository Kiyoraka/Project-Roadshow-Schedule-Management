/* RoadCrew - js/staff/event.js
   Artboard 06 (Event Detail + Upload). One schedule, one promoter, photo check-ins.
   The check-in window and the photo cap come from settings.checkin - never hardcoded.
   Load order: data.js, util.js, auth.js, event.js
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

  // localStorage is small, so a phone photo is redrawn through a canvas first.
  var MAX_EDGE = 900;
  var JPEG_QUALITY = 0.7;

  var CALENDAR = 'calendar.html';
  var LEAVE_MS = 1200;
  // Written as escapes so file encoding cannot break them, as in util.js.
  var DASH = '\u2013';
  var DOT = '\u00b7';

  var schedule = null;       // the one schedule this page is about
  var rules = {};            // settings.checkin
  var photo = '';            // data URL of the photo waiting to be submitted
  var maxPhotos = null;      // null means the setting is absent - no cap
  var atCap = false;
  var inWindow = true;

  function byId(id) { return document.getElementById(id); }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function trim(value) {
    return String(value === null || typeof value === 'undefined' ? '' : value)
      .replace(/^\s+|\s+$/g, '');
  }

  function nowHM() {
    var d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function go(url) {
    try {
      window.location.href = url;
    } catch (e) {
      // Nothing more we can do.
    }
  }

  // Seed photos are root-relative; submitted photos are data URLs and stay untouched.
  function photoSrc(value) {
    var p = String(value || '');
    if (p === '') { return ''; }
    if (p.indexOf('data:') === 0) { return p; }
    return '../' + p;
  }

  function hex6(value) {
    var h = String(value || '').replace('#', '');
    return /^[0-9a-fA-F]{6}$/.test(h) ? h : '';
  }

  function tint(color) {
    var h = hex6(color);
    if (!h) { return 'var(--line-soft)'; }
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' +
                     parseInt(h.slice(2, 4), 16) + ',' +
                     parseInt(h.slice(4, 6), 16) + ',.10)';
  }

  function ink(color) {
    var h = hex6(color);
    return h ? '#' + h : 'var(--ink)';
  }

  /* --------------------------------------------------------------- guard -- */

  function queryId() {
    var search = String(window.location.search || '');
    var hit = /[?&]id=([^&]+)/.exec(search);
    if (!hit) { return null; }
    try {
      return decodeURIComponent(hit[1]);
    } catch (e) {
      return hit[1];
    }
  }

  // Returns null when this promoter may open this event, else the reason to show.
  function blockedReason() {
    var id = queryId();
    if (!id) {
      return 'That event could not be found.';
    }
    var s = R.db.byId('schedules', id);
    if (!s) {
      return 'That event could not be found.';
    }
    var mine = s.spIds && s.spIds.indexOf ? s.spIds.indexOf(me.id) !== -1 : false;
    if (!mine) {
      return 'This event is not on your schedule.';
    }
    if (U.deriveStatus(s) === 'cancelled') {
      return 'This event has been cancelled.';
    }
    schedule = s;
    return null;
  }

  /* ---------------------------------------------------------------- card -- */

  function coversToday() {
    var today = U.todayISO();
    return today >= schedule.startDate && today <= schedule.endDate;
  }

  function renderCard() {
    var outlet = R.db.byId('outlets', schedule.outletId);
    var brand = R.db.byId('brands', schedule.brandId);

    var badge = '';
    if (brand) {
      badge = '<span class="badge badge-brand" style="--brand-tint:' + tint(brand.color) +
              ';--brand-ink:' + ink(brand.color) + '">' + U.escapeHtml(brand.name) + '</span>';
    }
    var pill = coversToday() ? '<span class="today-pill">Today</span>' : '';

    var bits = [];
    if (outlet && outlet.city) { bits.push(outlet.city); }
    bits.push(U.fmtRange(schedule.startDate, schedule.endDate));
    if (schedule.shift) { bits.push(schedule.shift); }

    byId('event-card').innerHTML =
      '<div class="today-top">' + badge + pill + '</div>' +
      '<div class="today-name-lg">' + U.escapeHtml(outlet ? outlet.name : 'Event') + '</div>' +
      '<div class="today-meta-lg">' + U.escapeHtml(bits.join(' ' + DOT + ' ')) + '</div>';
  }

  /* -------------------------------------------------------------- shots -- */

  function myCheckins() {
    var all = R.db.checkins();
    var out = [];
    var i;
    for (i = 0; i < all.length; i++) {
      var c = all[i];
      if (c && c.scheduleId === schedule.id && c.userId === me.id) {
        out.push(c);
      }
    }
    // Oldest first.
    out.sort(function (a, b) {
      var ka = String(a.date) + ' ' + String(a.time);
      var kb = String(b.date) + ' ' + String(b.time);
      if (ka === kb) { return a.id < b.id ? -1 : 1; }
      return ka < kb ? -1 : 1;
    });
    return out;
  }

  function renderShots() {
    var rows = myCheckins();
    var host = byId('shots');

    if (!rows.length) {
      host.innerHTML = '<div class="up-empty">No photos yet for this event.</div>';
      return;
    }

    var html = '';
    var i;
    for (i = 0; i < rows.length; i++) {
      var c = rows[i];
      var src = photoSrc(c.photo);
      var img = src ? '<img class="shot-img" src="' + U.escapeHtml(src) + '" alt="">' : '';
      html += '<div class="shot">' +
                '<div class="shot-frame">' + img +
                  '<span class="shot-stamp">' +
                    U.escapeHtml(U.fmtDayMon(c.date) + ' ' + DOT + ' ' + (c.time || '')) +
                  '</span>' +
                '</div>' +
                '<div class="shot-cap">' + U.escapeHtml(c.note || '') + '</div>' +
              '</div>';
    }
    host.innerHTML = html;
  }

  /* ------------------------------------------------- settings.checkin ----- */

  function applyRules() {
    var settings = R.db.settings() || {};
    rules = settings.checkin || {};

    var cap = parseInt(rules.maxPhotos, 10);
    maxPhotos = (isNaN(cap) || cap < 0) ? null : cap;
    atCap = maxPhotos !== null && myCheckins().length >= maxPhotos;

    var start = typeof rules.windowStart === 'string' ? rules.windowStart : '';
    var end = typeof rules.windowEnd === 'string' ? rules.windowEnd : '';
    inWindow = true;
    if (start && end) {
      var now = nowHM();
      inWindow = now >= start && now <= end;
    }

    // The picker closes at the cap; outside the window only the submit locks.
    byId('file').disabled = atCap;

    var sub;
    if (atCap) {
      sub = 'Photo limit reached for this event.';
    } else if (!inWindow) {
      sub = 'Check-in opens ' + start + ' ' + DASH + ' ' + end + '.';
    } else if (maxPhotos !== null) {
      sub = 'Photo proof of presence ' + DOT + ' up to ' + maxPhotos + ' per event';
    } else {
      sub = 'Photo proof of presence';
    }
    byId('drop-sub').textContent = sub;
  }

  function syncSubmit() {
    var ok = !atCap && inWindow;
    if (ok && rules.photoRequired !== false && !photo) {
      ok = false;
    }
    byId('submit').disabled = !ok;
  }

  /* -------------------------------------------------------------- upload -- */

  // Redraw through a canvas so a raw phone photo cannot overflow localStorage.
  function downscale(dataUrl, done) {
    var img = new Image();
    img.onload = function () {
      var out = dataUrl;
      try {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (w && h) {
          var scale = Math.min(1, MAX_EDGE / Math.max(w, h));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          out = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        }
      } catch (e) {
        out = dataUrl;   // canvas unavailable - keep what the reader gave us
      }
      done(out);
    };
    img.onerror = function () { done(dataUrl); };
    img.src = dataUrl;
  }

  // base.css sets img { display: block }, and an author rule outranks the UA
  // [hidden] rule, so the preview is toggled through both.
  function showPreview(src) {
    var preview = byId('preview');
    if (src) {
      preview.src = src;
      preview.hidden = false;
      preview.style.display = 'block';
      return;
    }
    preview.removeAttribute('src');
    preview.hidden = true;
    preview.style.display = 'none';
  }

  function takeFile(file) {
    if (!file || atCap) { return; }
    if (String(file.type || '').indexOf('image/') !== 0) {
      U.toast('Please choose an image file.', 'danger');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      downscale(String(reader.result || ''), function (out) {
        photo = out;
        showPreview(out);
        syncSubmit();
      });
    };
    reader.onerror = function () {
      U.toast('Could not read that photo.', 'danger');
    };
    reader.readAsDataURL(file);
  }

  function clearForm() {
    photo = '';
    showPreview('');
    byId('file').value = '';
    byId('note').value = '';
  }

  /* -------------------------------------------------------------- submit -- */

  function submit() {
    if (byId('submit').disabled) { return; }

    var record = {
      id: U.uid('c'),
      scheduleId: schedule.id,
      userId: me.id,
      date: U.todayISO(),
      time: nowHM(),
      photo: photo,
      note: trim(byId('note').value)
    };

    R.db.upsert('checkins', record);
    U.toast('Checked in at ' + record.time + '.', 'success');

    clearForm();
    applyRules();
    renderShots();
    syncSubmit();
  }

  /* ---------------------------------------------------------------- wire -- */

  function wire() {
    byId('back').addEventListener('click', function () {
      go(CALENDAR);
    });

    byId('file').addEventListener('change', function () {
      takeFile(this.files && this.files.length ? this.files[0] : null);
    });

    byId('submit').addEventListener('click', submit);

    var drop = byId('drop');

    drop.addEventListener('dragover', function (ev) {
      ev.preventDefault();
      if (atCap) { return; }
      drop.classList.add('is-drag');
    });

    drop.addEventListener('dragleave', function () {
      drop.classList.remove('is-drag');
    });

    drop.addEventListener('drop', function (ev) {
      ev.preventDefault();
      drop.classList.remove('is-drag');
      if (atCap) { return; }
      var dt = ev.dataTransfer;
      if (dt && dt.files && dt.files.length) {
        takeFile(dt.files[0]);
      }
    });
  }

  function init() {
    var blocked = blockedReason();
    if (blocked) {
      U.toast(blocked, 'danger');
      window.setTimeout(function () { go(CALENDAR); }, LEAVE_MS);
      return;
    }

    showPreview('');
    renderCard();
    applyRules();
    renderShots();
    wire();
    syncSubmit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.RoadCrew);
