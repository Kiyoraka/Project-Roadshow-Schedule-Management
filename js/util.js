window.RoadCrew = window.RoadCrew || {};
(function (R) {
  'use strict';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // En dash (U+2013), written as an escape so file encoding cannot break it.
  var DASH = '\u2013';

  var TOAST_HOST_ID = 'rc-toast-host';
  var TOAST_LIFE_MS = 3000;
  var toastQueue = [];
  var flushBound = false;

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  // Local 'YYYY-MM-DD' for any Date. Never UTC-convert - that shifts the day in UTC+8.
  function toISO(dateObj) {
    var d = (dateObj instanceof Date) ? dateObj : new Date(dateObj);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function todayISO() {
    return toISO(new Date());
  }

  // Date at LOCAL midnight. Split on '-' so the engine never UTC-parses the string.
  function fromISO(iso) {
    if (!iso) { return null; }
    var parts = String(iso).split('-');
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) { return null; }
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  function monthName(iso) {
    var parts = String(iso).split('-');
    var m = parseInt(parts[1], 10);
    return MONTHS[m - 1] || '';
  }

  function dayNum(iso) {
    return parseInt(String(iso).split('-')[2], 10);
  }

  function yearNum(iso) {
    return parseInt(String(iso).split('-')[0], 10);
  }

  // '5 Sep 2026'
  function fmtDate(iso) {
    if (!iso) { return ''; }
    return dayNum(iso) + ' ' + monthName(iso) + ' ' + yearNum(iso);
  }

  // '5 Sep'
  function fmtDayMon(iso) {
    if (!iso) { return ''; }
    return dayNum(iso) + ' ' + monthName(iso);
  }

  // '12 Sep 2026' | '4-6 Sep 2026' | '30 Jul - 1 Aug 2026' | '30 Dec 2026 - 1 Jan 2027'
  function fmtRange(startIso, endIso) {
    if (!startIso && !endIso) { return ''; }
    if (!startIso) { return fmtDate(endIso); }
    if (!endIso || startIso === endIso) { return fmtDate(startIso); }

    var sY = yearNum(startIso);
    var eY = yearNum(endIso);
    var sM = monthName(startIso);
    var eM = monthName(endIso);

    if (sY !== eY) {
      return fmtDate(startIso) + ' ' + DASH + ' ' + fmtDate(endIso);
    }
    if (sM !== eM) {
      return fmtDayMon(startIso) + ' ' + DASH + ' ' + fmtDate(endIso);
    }
    return dayNum(startIso) + DASH + dayNum(endIso) + ' ' + sM + ' ' + sY;
  }

  // Inclusive array of ISO strings from start to end.
  function daysBetween(startIso, endIso) {
    var out = [];
    var start = fromISO(startIso);
    var end = fromISO(endIso);
    if (!start || !end) { return out; }
    if (end < start) { return out; }
    var cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor <= end) {
      out.push(toISO(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  // Inclusive on both ends. String compare on 'YYYY-MM-DD' is lexicographically correct.
  function overlaps(aStart, aEnd, bStart, bEnd) {
    if (!aStart || !aEnd || !bStart || !bEnd) { return false; }
    return aStart <= bEnd && bStart <= aEnd;
  }

  // Section 6 rules. String comparison on 'YYYY-MM-DD' is intended - no Date conversion.
  function deriveStatus(schedule) {
    if (!schedule) { return 'planned'; }
    if (schedule.status === 'cancelled') { return 'cancelled'; }
    var today = todayISO();
    if (today < schedule.startDate) { return 'planned'; }
    if (today >= schedule.startDate && today <= schedule.endDate) { return 'ongoing'; }
    return 'completed';
  }

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36);
  }

  // 'Rou Qian' -> 'R'
  function initials(name) {
    if (!name) { return ''; }
    var trimmed = String(name).replace(/^\s+/, '');
    if (!trimmed) { return ''; }
    return trimmed.charAt(0).toUpperCase();
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) { return ''; }
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toastHost() {
    var host = document.getElementById(TOAST_HOST_ID);
    if (host) { return host; }
    host = document.createElement('div');
    host.id = TOAST_HOST_ID;
    // Fallback inline styles on the HOST only, so toasts stay visible
    // even if css/base.css has not loaded.
    host.style.position = 'fixed';
    host.style.left = '50%';
    host.style.bottom = '24px';
    host.style.transform = 'translateX(-50%)';
    host.style.zIndex = '9999';
    host.style.display = 'flex';
    host.style.flexDirection = 'column';
    host.style.alignItems = 'center';
    host.style.gap = '8px';
    host.style.pointerEvents = 'none';
    document.body.appendChild(host);
    return host;
  }

  function showToast(message, variant) {
    var kind = (variant === 'success' || variant === 'danger' || variant === 'info')
      ? variant : 'info';
    var host = toastHost();
    var node = document.createElement('div');
    node.className = 'rc-toast rc-toast-' + kind;
    node.setAttribute('role', 'status');
    node.textContent = message === null || message === undefined ? '' : String(message);
    host.appendChild(node);
    window.setTimeout(function () {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }, TOAST_LIFE_MS);
  }

  function flushToastQueue() {
    var pending = toastQueue;
    toastQueue = [];
    for (var i = 0; i < pending.length; i++) {
      showToast(pending[i].message, pending[i].variant);
    }
  }

  // Safe to call before DOMContentLoaded: queue, then flush when the body exists.
  function toast(message, variant) {
    if (!document.body) {
      toastQueue.push({ message: message, variant: variant });
      if (!flushBound) {
        flushBound = true;
        document.addEventListener('DOMContentLoaded', function () {
          flushToastQueue();
        });
      }
      return;
    }
    if (toastQueue.length) { flushToastQueue(); }
    showToast(message, variant);
  }

  R.util = {
    todayISO: todayISO,
    toISO: toISO,
    fromISO: fromISO,
    fmtDate: fmtDate,
    fmtRange: fmtRange,
    fmtDayMon: fmtDayMon,
    daysBetween: daysBetween,
    overlaps: overlaps,
    deriveStatus: deriveStatus,
    uid: uid,
    initials: initials,
    escapeHtml: escapeHtml,
    toast: toast
  };

})(window.RoadCrew);
