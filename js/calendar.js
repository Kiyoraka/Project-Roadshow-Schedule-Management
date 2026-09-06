window.RoadCrew = window.RoadCrew || {};
(function (R) {
  'use strict';

  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

  // Weeks start on Sunday.
  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var DAYS_PER_WEEK = 7;
  var MAX_DOTS = 3;
  var DEFAULT_COLOR = '#647082';

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function isoOf(year, month, day) {
    return year + '-' + pad2(month + 1) + '-' + pad2(day);
  }

  // Accepts a month index outside 0-11 and folds it back into a real year/month.
  function normalize(year, month) {
    var y = parseInt(year, 10);
    var m = parseInt(month, 10);
    if (isNaN(y)) { y = new Date().getFullYear(); }
    if (isNaN(m)) { m = new Date().getMonth(); }
    y = y + Math.floor(m / 12);
    m = m - Math.floor(m / 12) * 12;
    return { year: y, month: m };
  }

  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function firstWeekday(year, month) {
    return new Date(year, month, 1).getDay();
  }

  function monthLabel(year, month) {
    var n = normalize(year, month);
    return MONTH_NAMES[n.month] + ' ' + n.year;
  }

  function prevMonth(year, month) {
    return normalize(year, parseInt(month, 10) - 1);
  }

  function nextMonth(year, month) {
    return normalize(year, parseInt(month, 10) + 1);
  }

  function esc(value) {
    return R.util.escapeHtml(value);
  }

  // Colours land in a style attribute, so keep them to characters a colour can contain.
  function safeColor(value) {
    if (!value) { return DEFAULT_COLOR; }
    var cleaned = String(value).replace(/[^#A-Za-z0-9(),.%\s\-]/g, '');
    cleaned = cleaned.replace(/^\s+|\s+$/g, '');
    return cleaned || DEFAULT_COLOR;
  }

  function resolveContainer(container) {
    if (!container) { return null; }
    if (typeof container === 'string') { return document.querySelector(container); }
    return container;
  }

  // Normalises one caller-supplied event and drops anything undatable.
  function normalizeEvent(raw, index) {
    if (!raw) { return null; }
    var start = raw.startDate || raw.endDate;
    var end = raw.endDate || raw.startDate;
    if (!start || !end) { return null; }
    if (end < start) {
      var swap = start;
      start = end;
      end = swap;
    }
    return {
      id: (raw.id === null || raw.id === undefined) ? ('evt-' + index) : String(raw.id),
      start: String(start),
      end: String(end),
      color: safeColor(raw.color),
      label: (raw.label === null || raw.label === undefined) ? '' : String(raw.label),
      dot: raw.dot
    };
  }

  function normalizeEvents(list) {
    var out = [];
    if (!list || !list.length) { return out; }
    for (var i = 0; i < list.length; i++) {
      var evt = normalizeEvent(list[i], i);
      if (evt) { out.push(evt); }
    }
    // Earliest start first; on a tie the longer event leads so it takes the top lane.
    out.sort(function (a, b) {
      if (a.start !== b.start) { return a.start < b.start ? -1 : 1; }
      if (a.end !== b.end) { return a.end > b.end ? -1 : 1; }
      return 0;
    });
    return out;
  }

  function covers(evt, iso) {
    return evt.start <= iso && iso <= evt.end;
  }

  function eventsOnDay(events, iso) {
    var out = [];
    for (var i = 0; i < events.length; i++) {
      if (covers(events[i], iso)) { out.push(events[i]); }
    }
    return out;
  }

  // Whole weeks. weekStart is 0 for Sunday (admin) or 1 for Monday (the staff
  // artboard). With fillAdjacent the leading and trailing cells carry the real
  // adjacent-month day numbers, marked outside, instead of being blank - which
  // is what artboard 05 shows.
  function buildWeeks(year, month, weekStart, fillAdjacent) {
    var lead = (firstWeekday(year, month) - weekStart + DAYS_PER_WEEK) % DAYS_PER_WEEK;
    var total = daysInMonth(year, month);
    var cellCount = Math.ceil((lead + total) / DAYS_PER_WEEK) * DAYS_PER_WEEK;
    var prev = prevMonth(year, month);
    var next = nextMonth(year, month);
    var prevTotal = daysInMonth(prev.year, prev.month);
    var weeks = [];
    var week = [];

    for (var i = 0; i < cellCount; i++) {
      var dayNum = i - lead + 1;
      if (dayNum < 1) {
        week.push(fillAdjacent
          ? { day: prevTotal + dayNum, iso: isoOf(prev.year, prev.month, prevTotal + dayNum), outside: true }
          : null);
      } else if (dayNum > total) {
        week.push(fillAdjacent
          ? { day: dayNum - total, iso: isoOf(next.year, next.month, dayNum - total), outside: true }
          : null);
      } else {
        week.push({ day: dayNum, iso: isoOf(year, month, dayNum) });
      }
      if (week.length === DAYS_PER_WEEK) {
        weeks.push(week);
        week = [];
      }
    }
    return weeks;
  }

  function headHtml(labels, weekStart) {
    var html = '<div class="rc-cal-head">';
    for (var i = 0; i < DAYS_PER_WEEK; i++) {
      var label = labels && labels.length === DAYS_PER_WEEK
        ? labels[i]
        : WEEKDAYS[(i + weekStart) % DAYS_PER_WEEK];
      html += '<div class="rc-cal-head-cell">' + esc(label) + '</div>';
    }
    return html + '</div>';
  }

  function dotsHtml(events) {
    if (!events.length) { return ''; }
    var count = Math.min(events.length, MAX_DOTS);
    var html = '<div class="rc-cal-dots">';
    for (var i = 0; i < count; i++) {
      html += '<span class="rc-cal-dot" data-event-id="' + esc(events[i].id) + '"' +
              ' title="' + esc(events[i].label) + '"' +
              ' style="background:' + events[i].color + '"></span>';
    }
    return html + '</div>';
  }

  function cellHtml(cell, ctx, inner) {
    if (!cell) {
      return '<div class="rc-cal-cell rc-cal-cell-blank"></div>';
    }
    var cls = 'rc-cal-cell';
    if (cell.outside) { cls += ' rc-cal-cell-outside'; }
    if (cell.iso === ctx.today) { cls += ' rc-cal-cell-today'; }
    if (ctx.selectedDate && cell.iso === ctx.selectedDate) { cls += ' rc-cal-cell-selected'; }

    // A day already carrying photo proof gets the artboard's small green tick.
    var check = (ctx.checks && ctx.checks[cell.iso] && !cell.outside)
      ? '<span class="rc-cal-check">&#10003;</span>'
      : '';

    return '<div class="' + cls + '" data-day="' + cell.iso + '">' +
             check +
             '<div class="rc-cal-daynum">' + cell.day + '</div>' +
             (inner || '') +
           '</div>';
  }

  // One <div class="rc-cal-bar"> per week-slice of an event, so a run such as 27-31 Aug
  // is a single element across those cells instead of one chip per day.
  function barsHtml(week, events) {
    var firstIso = null;
    var lastIso = null;
    var i;

    for (i = 0; i < week.length; i++) {
      if (week[i]) {
        if (firstIso === null) { firstIso = week[i].iso; }
        lastIso = week[i].iso;
      }
    }
    if (firstIso === null) { return ''; }

    var html = '';
    for (i = 0; i < events.length; i++) {
      var evt = events[i];
      if (evt.end < firstIso || evt.start > lastIso) { continue; }

      var startCol = -1;
      var endCol = -1;
      for (var c = 0; c < week.length; c++) {
        if (week[c] && covers(evt, week[c].iso)) {
          if (startCol === -1) { startCol = c; }
          endCol = c;
        }
      }
      if (startCol === -1) { continue; }

      var cls = 'rc-cal-bar';
      if (week[startCol].iso === evt.start) { cls += ' rc-cal-bar-start'; }
      if (week[endCol].iso === evt.end) { cls += ' rc-cal-bar-end'; }

      // grid-column places the slice; a stylesheet that is not grid-based still
      // renders the bar as a plain block rather than mispositioning it.
      html += '<div class="' + cls + '" data-event-id="' + esc(evt.id) + '"' +
              ' data-col="' + (startCol + 1) + '" data-span="' + (endCol - startCol + 1) + '"' +
              ' title="' + esc(evt.label) + '"' +
              ' style="grid-column:' + (startCol + 1) + ' / span ' + (endCol - startCol + 1) +
              ';background:' + evt.color + '">' +
                '<span class="rc-cal-bar-label">' + esc(evt.label) + '</span>' +
              '</div>';
    }

    if (!html) { return ''; }
    return '<div class="rc-cal-bars">' + html + '</div>';
  }

  function staffGridHtml(weeks, events, ctx) {
    var html = '<div class="rc-cal-grid">';
    for (var w = 0; w < weeks.length; w++) {
      for (var d = 0; d < weeks[w].length; d++) {
        var cell = weeks[w][d];
        var inner = cell ? dotsHtml(eventsOnDay(events, cell.iso)) : '';
        html += cellHtml(cell, ctx, inner);
      }
    }
    return html + '</div>';
  }

  function adminGridHtml(weeks, events, ctx) {
    var html = '<div class="rc-cal-grid">';
    for (var w = 0; w < weeks.length; w++) {
      html += '<div class="rc-cal-week">';
      for (var d = 0; d < weeks[w].length; d++) {
        html += cellHtml(weeks[w][d], ctx, '');
      }
      html += barsHtml(weeks[w], events);
      html += '</div>';
    }
    return html + '</div>';
  }

  function wire(root, opts) {
    var onDayClick = typeof opts.onDayClick === 'function' ? opts.onDayClick : null;
    var onEventClick = typeof opts.onEventClick === 'function' ? opts.onEventClick : null;
    var i;

    if (onEventClick) {
      var marks = root.querySelectorAll('[data-event-id]');
      for (i = 0; i < marks.length; i++) {
        marks[i].addEventListener('click', function (ev) {
          // A bar or dot sits inside a day cell - do not also fire onDayClick.
          ev.stopPropagation();
          onEventClick(this.getAttribute('data-event-id'));
        });
      }
    }

    if (onDayClick) {
      var cells = root.querySelectorAll('[data-day]');
      for (i = 0; i < cells.length; i++) {
        cells[i].addEventListener('click', function () {
          onDayClick(this.getAttribute('data-day'));
        });
      }
    }
  }

  function renderMonth(container, opts) {
    var root = resolveContainer(container);
    if (!root) { return; }

    var o = opts || {};
    var i;
    var n = normalize(o.year, o.month);
    var events = normalizeEvents(o.events);
    var mode = o.mode === 'admin' ? 'admin' : 'staff';
    var weekStart = o.weekStart === 1 ? 1 : 0;
    var fillAdjacent = !!o.fillAdjacent;
    var weeks = buildWeeks(n.year, n.month, weekStart, fillAdjacent);

    var checks = {};
    if (o.checks && o.checks.length) {
      for (i = 0; i < o.checks.length; i++) { checks[o.checks[i]] = true; }
    }

    var ctx = {
      today: R.util.todayISO(),
      selectedDate: o.selectedDate || null,
      checks: checks
    };

    var body = mode === 'admin'
      ? adminGridHtml(weeks, events, ctx)
      : staffGridHtml(weeks, events, ctx);

    root.innerHTML = '<div class="rc-cal">' + headHtml(o.dayLabels, weekStart) + body + '</div>';
    wire(root, o);
  }

  R.calendar = {
    renderMonth: renderMonth,
    monthLabel: monthLabel,
    prevMonth: prevMonth,
    nextMonth: nextMonth
  };

})(window.RoadCrew);
