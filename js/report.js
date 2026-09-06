/* RoadCrew - js/report.js
   Brand sales report: derivation only. Chart rendering is added separately.

   Load order on index.html: data.js, util.js, auth.js, report.js, landing.js

   Stage 2 seam (see Project Resources/project-plan.md section 0):
   the client's schedule model is one supervisor plus a pax head-count. Ours is still an
   array of named promoters. Every read of "who is on this schedule" goes through
   supervisorOf() and paxOf() below, so the move needs two lines changed here and nothing
   changed in any renderer.
   -------------------------------------------------------------------------- */

window.RoadCrew = window.RoadCrew || {};

(function (R) {
  'use strict';

  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var WEEK_DAYS = 7;

  /* ------------------------------------------------- Stage 2 seam ------- */

  // Today: the first assigned promoter stands in as the supervisor.
  // Stage 2: return R.db.byId('users', schedule.supervisorId).
  function supervisorOf(schedule) {
    if (!schedule || !schedule.spIds || !schedule.spIds.length) { return null; }
    return R.db.byId('users', schedule.spIds[0]);
  }

  // Today: the head-count is however many promoters are assigned.
  // Stage 2: return schedule.pax.
  function paxOf(schedule) {
    if (!schedule || !schedule.spIds) { return 0; }
    return schedule.spIds.length;
  }

  /* ----------------------------------------------------------- helpers -- */

  function brandOfSchedule(scheduleId) {
    var s = R.db.byId('schedules', scheduleId);
    return s ? s.brandId : null;
  }

  // Every sale belonging to one brand, resolved through its schedule.
  function salesFor(brandId) {
    var all = R.db.sales();
    var out = [];
    var i;
    for (i = 0; i < all.length; i++) {
      if (brandOfSchedule(all[i].scheduleId) === brandId) { out.push(all[i]); }
    }
    return out;
  }

  function productsFor(brandId) {
    var all = R.db.products();
    var out = [];
    var i;
    for (i = 0; i < all.length; i++) {
      if (all[i].brandId === brandId) { out.push(all[i]); }
    }
    return out;
  }

  function latestDate(rows) {
    var max = null;
    var i;
    for (i = 0; i < rows.length; i++) {
      if (max === null || rows[i].date > max) { max = rows[i].date; }
    }
    return max;
  }

  /* -------------------------------------------------------- week window -- */

  // The seven consecutive days ENDING on the brand's most recent sale.
  // Derived from sales dates only, never from schedule dates - so Stage 2's
  // non-contiguous dates[] cannot change the shape of the report week.
  function weekEndingOn(iso) {
    var end = R.util.fromISO(iso);
    var days = [];
    var i;
    for (i = WEEK_DAYS - 1; i >= 0; i--) {
      var d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
      days.push({ iso: R.util.toISO(d), dow: DOW[d.getDay()], day: d.getDate() });
    }
    return days;
  }

  /* -------------------------------------------------------------- build -- */

  function build(brandId) {
    var brand = R.db.byId('brands', brandId);
    if (!brand) { return null; }

    var sales = salesFor(brandId);
    if (!sales.length) {
      return { brand: brand, empty: true, total: 0, week: [], products: [], outlets: [] };
    }

    var week = weekEndingOn(latestDate(sales));
    var inWeek = {};
    var i;
    for (i = 0; i < week.length; i++) { inWeek[week[i].iso] = true; }

    var perDay = {};
    var perProduct = {};
    var perSchedule = {};
    var total = 0;

    for (i = 0; i < sales.length; i++) {
      var sa = sales[i];
      if (!inWeek[sa.date]) { continue; }          // older campaigns stay out of this week
      perDay[sa.date] = (perDay[sa.date] || 0) + sa.units;
      perProduct[sa.productId] = (perProduct[sa.productId] || 0) + sa.units;
      perSchedule[sa.scheduleId] = (perSchedule[sa.scheduleId] || 0) + sa.units;
      total += sa.units;
    }

    // Zero-fill: a day with no event is a real zero, not a gap in the chart.
    var days = [];
    var peak = 0;
    for (i = 0; i < week.length; i++) {
      var units = perDay[week[i].iso] || 0;
      if (units > peak) { peak = units; }
      days.push({ iso: week[i].iso, dow: week[i].dow, day: week[i].day, units: units });
    }
    for (i = 0; i < days.length; i++) {
      days[i].isPeak = peak > 0 && days[i].units === peak;
    }

    // Every product of the brand appears, including one that sold nothing.
    var prods = productsFor(brandId);
    var ranked = [];
    for (i = 0; i < prods.length; i++) {
      var units2 = perProduct[prods[i].id] || 0;
      ranked.push({
        id: prods[i].id,
        name: prods[i].name,
        units: units2,
        share: total ? Math.round((units2 / total) * 1000) / 10 : 0
      });
    }
    ranked.sort(function (a, b) {
      if (a.units !== b.units) { return b.units - a.units; }
      return a.name < b.name ? -1 : 1;
    });

    // Outlet rows carry the client's vocabulary - supervisor and pax - from day one.
    var outlets = [];
    for (var id in perSchedule) {
      if (!Object.prototype.hasOwnProperty.call(perSchedule, id)) { continue; }
      var sch = R.db.byId('schedules', id);
      if (!sch) { continue; }
      var sup = supervisorOf(sch);
      outlets.push({
        scheduleId: id,
        outlet: (R.db.byId('outlets', sch.outletId) || {}).name || '',
        dates: R.util.fmtRange(sch.startDate, sch.endDate),
        supervisor: sup ? sup.name : 'Unassigned',
        pax: paxOf(sch),
        units: perSchedule[id]
      });
    }
    outlets.sort(function (a, b) { return b.units - a.units; });

    return {
      brand: brand,
      empty: false,
      total: total,
      peak: peak,
      week: days,
      rangeLabel: R.util.fmtRange(days[0].iso, days[days.length - 1].iso),
      products: ranked,
      outlets: outlets
    };
  }

  /* ----------------------------------------------------------- password -- */

  // A browser-side check. It gates presentation, not access - nothing sensitive
  // sits behind it, and the value is readable in the page source.
  function checkPassword(brandId, value) {
    var brand = R.db.byId('brands', brandId);
    if (!brand || !brand.reportPassword) { return false; }
    return String(value || '') === String(brand.reportPassword);
  }

  // Brands that have something to show, for the Info section cards.
  function listBrands() {
    var brands = R.db.brands();
    var out = [];
    var i;
    for (i = 0; i < brands.length; i++) {
      out.push({
        id: brands[i].id,
        name: brands[i].name,
        color: brands[i].color,
        hasData: salesFor(brands[i].id).length > 0
      });
    }
    return out;
  }

  /* --------------------------------------------------------- chart marks -- */

  function esc(v) { return R.util.escapeHtml(v); }

  // A bar rounded only at its data end and anchored flat to the baseline.
  function barPath(x, y0, w, h, r) {
    var rad = Math.min(r, w / 2, h);
    if (h <= 0) { return ''; }
    var top = y0 - h;
    return 'M' + x + ' ' + y0 +
           'L' + x + ' ' + (top + rad) +
           'Q' + x + ' ' + top + ' ' + (x + rad) + ' ' + top +
           'L' + (x + w - rad) + ' ' + top +
           'Q' + (x + w) + ' ' + top + ' ' + (x + w) + ' ' + (top + rad) +
           'L' + (x + w) + ' ' + y0 + 'Z';
  }

  function hBarPath(x, y, w, h, r) {
    var rad = Math.min(r, h / 2, w);
    if (w <= 0) { return ''; }
    return 'M' + x + ' ' + y +
           'L' + (x + w - rad) + ' ' + y +
           'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + rad) +
           'L' + (x + w) + ' ' + (y + h - rad) +
           'Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - rad) + ' ' + (y + h) +
           'L' + x + ' ' + (y + h) + 'Z';
  }

  // Round a maximum up to a friendly axis top.
  function niceTop(max) {
    if (max <= 0) { return 10; }
    var step = Math.pow(10, Math.floor(Math.log(max) / Math.LN10)) / 2;
    return Math.ceil(max / step) * step;
  }

  // CHART 1 - units per day. Seven discrete days, so bars rather than a line.
  // One series, so the brand hue carries identity and length carries magnitude;
  // no legend is needed because the block title names the series.
  function daysChartSvg(data) {
    var W = 660, H = 214;
    var padL = 40, padR = 8, padT = 18, padB = 30;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;
    var y0 = padT + plotH;
    var top = niceTop(data.peak);
    var colW = plotW / data.week.length;
    var barW = Math.round(colW * 0.56);
    var color = data.brand.color;
    var i;

    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
              'aria-label="Units sampled per day">';

    // Recessive gridlines, and the axis scale on the left.
    for (i = 0; i <= 2; i++) {
      var val = top * (i / 2);
      var gy = y0 - (plotH * (i / 2));
      svg += '<line class="chart-grid" x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '"></line>';
      svg += '<text class="chart-axis" x="' + (padL - 8) + '" y="' + (gy + 4) + '" text-anchor="end">' + Math.round(val) + '</text>';
    }

    for (i = 0; i < data.week.length; i++) {
      var d = data.week[i];
      var cx = padL + colW * i;
      var bx = Math.round(cx + (colW - barW) / 2);
      var h = top ? Math.round((d.units / top) * plotH) : 0;

      svg += '<g class="chart-col" data-tip="' + esc(d.dow + ' ' + d.day + ' - ' + d.units + ' units') + '">';
      svg += '<rect class="chart-hit" x="' + cx + '" y="' + padT + '" width="' + colW + '" height="' + plotH + '"></rect>';

      if (d.units > 0) {
        svg += '<path class="chart-bar" d="' + barPath(bx, y0, barW, h, 4) + '" fill="' + color + '"></path>';
      } else {
        // A zero day is drawn as a flat stub so the day reads as zero, not missing.
        svg += '<rect x="' + bx + '" y="' + (y0 - 2) + '" width="' + barW + '" height="2" fill="var(--line-strong)"></rect>';
      }

      // Selective direct labelling: the peak only. Everything else is on hover.
      if (d.isPeak && d.units > 0) {
        svg += '<text class="chart-value" x="' + (bx + barW / 2) + '" y="' + (y0 - h - 6) + '" text-anchor="middle">' + d.units + '</text>';
      }

      svg += '<text class="chart-axis" x="' + (cx + colW / 2) + '" y="' + (y0 + 18) + '" text-anchor="middle">' +
             esc(d.dow) + ' ' + d.day + '</text>';
      svg += '</g>';
    }

    return svg + '</svg>';
  }

  // CHART 2 - product popularity, ranked. Every bar takes the same hue at the same
  // step: length alone encodes the value, so colour never implies an extra meaning.
  function productsChartSvg(data) {
    var rowH = 34, gap = 6;
    var W = 660;
    var H = data.products.length * (rowH + gap);
    var labelW = 190, valueW = 54;
    var trackW = W - labelW - valueW - 12;
    var max = data.products.length ? data.products[0].units : 0;
    var color = data.brand.color;
    var i;

    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
              'aria-label="Units sampled per product">';

    for (i = 0; i < data.products.length; i++) {
      var p = data.products[i];
      var y = i * (rowH + gap);
      var barH = 18;
      var by = y + (rowH - barH) / 2;
      var w = max ? Math.round((p.units / max) * trackW) : 0;

      svg += '<g class="chart-col" data-tip="' + esc(p.name + ' - ' + p.units + ' units, ' + p.share + '% of the week') + '">';
      svg += '<rect class="chart-hit" x="0" y="' + y + '" width="' + W + '" height="' + (rowH + gap) + '"></rect>';
      svg += '<text class="chart-name" x="0" y="' + (y + rowH / 2 + 4) + '">' + esc(p.name) + '</text>';

      if (w > 0) {
        svg += '<path class="chart-bar" d="' + hBarPath(labelW, by, w, barH, 4) + '" fill="' + color + '"></path>';
      } else {
        svg += '<rect x="' + labelW + '" y="' + by + '" width="2" height="' + barH + '" fill="var(--line-strong)"></rect>';
      }

      svg += '<text class="chart-value" x="' + (labelW + w + 10) + '" y="' + (y + rowH / 2 + 4) + '">' + p.units + '</text>';
      svg += '</g>';
    }

    return svg + '</svg>';
  }

  // Shared hover layer for both charts. One tooltip node, moved around.
  function attachTips(root) {
    var tip = null;

    function show(text, x, y) {
      if (!tip) {
        tip = document.createElement('div');
        tip.className = 'chart-tip';
        document.body.appendChild(tip);
      }
      tip.textContent = text;
      tip.style.left = (x + 14) + 'px';
      tip.style.top = (y - 10) + 'px';
      tip.hidden = false;
    }

    function hide() { if (tip) { tip.hidden = true; } }

    var cols = root.querySelectorAll('[data-tip]');
    var i;
    for (i = 0; i < cols.length; i++) {
      cols[i].addEventListener('mousemove', function (ev) {
        show(this.getAttribute('data-tip'), ev.clientX, ev.clientY);
      });
      cols[i].addEventListener('mouseleave', hide);
    }
    root.addEventListener('mouseleave', hide);
  }

  R.report = {
    build: build,
    checkPassword: checkPassword,
    listBrands: listBrands,
    supervisorOf: supervisorOf,
    paxOf: paxOf,
    daysChartSvg: daysChartSvg,
    productsChartSvg: productsChartSvg,
    attachTips: attachTips
  };

})(window.RoadCrew);
