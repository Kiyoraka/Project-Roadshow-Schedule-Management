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

  R.report = {
    build: build,
    checkPassword: checkPassword,
    listBrands: listBrands,
    supervisorOf: supervisorOf,
    paxOf: paxOf
  };

})(window.RoadCrew);
