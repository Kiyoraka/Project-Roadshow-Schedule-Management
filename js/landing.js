/* RoadCrew - js/landing.js
   Public landing page behaviour: nav, login modal, report password gate, report.
   Load order on index.html: data.js, util.js, auth.js, report.js, landing.js
   -------------------------------------------------------------------------- */

window.RoadCrew = window.RoadCrew || {};

(function (R) {
  'use strict';

  var U = R.util;
  var pendingBrandId = null;   // brand awaiting its password

  function byId(id) { return document.getElementById(id); }

  function open(id) {
    var el = byId(id);
    if (el) { el.className = 'modal is-open'; }
  }
  function close(id) {
    var el = byId(id);
    if (el) { el.className = 'modal'; }
  }

  /* ------------------------------------------------------------ nav ----- */

  function wireNav() {
    var burger = byId('nav-burger');
    var links = byId('nav-links');

    if (burger && links) {
      burger.addEventListener('click', function () {
        var openNow = links.className.indexOf('is-open') === -1;
        links.className = openNow ? 'nav-links is-open' : 'nav-links';
        burger.setAttribute('aria-expanded', openNow ? 'true' : 'false');
      });
    }

    var items = document.querySelectorAll('.nav-link');
    var i;
    for (i = 0; i < items.length; i++) {
      items[i].addEventListener('click', function (ev) {
        var href = this.getAttribute('href') || '';
        if (href.charAt(0) !== '#') { return; }
        var target = document.getElementById(href.slice(1));
        if (!target) { return; }
        ev.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (links) { links.className = 'nav-links'; }
        if (burger) { burger.setAttribute('aria-expanded', 'false'); }
      });
    }

    // Mark whichever section currently owns the top of the viewport.
    var ids = ['home', 'about', 'gallery', 'info'];
    function spy() {
      var best = ids[0];
      var j;
      for (j = 0; j < ids.length; j++) {
        var el = document.getElementById(ids[j]);
        if (el && el.getBoundingClientRect().top <= 120) { best = ids[j]; }
      }
      for (j = 0; j < items.length; j++) {
        var on = items[j].getAttribute('href') === '#' + best;
        items[j].className = on ? 'nav-link is-active' : 'nav-link';
      }
    }
    window.addEventListener('scroll', spy);
    spy();
  }

  /* ---------------------------------------------------------- login ----- */

  function safeNext(value) {
    if (!value) { return null; }
    if (value.indexOf('//') !== -1 || value.charAt(0) === '/' || value.indexOf(':') !== -1) { return null; }
    if (value.indexOf('..') !== -1) { return null; }
    return /\.html($|\?)/.test(value) ? value : null;
  }

  function queryParam(name) {
    var search = '';
    try { search = String(window.location.search || ''); } catch (e) { return null; }
    if (search.charAt(0) === '?') { search = search.slice(1); }
    if (search === '') { return null; }
    var pairs = search.split('&');
    var i;
    for (i = 0; i < pairs.length; i++) {
      var eq = pairs[i].indexOf('=');
      var key = eq === -1 ? pairs[i] : pairs[i].slice(0, eq);
      if (decodeURIComponent(key) === name) {
        return eq === -1 ? '' : decodeURIComponent(pairs[i].slice(eq + 1));
      }
    }
    return null;
  }

  function loginError(message) {
    var box = byId('login-error');
    if (box) { box.textContent = message; }
    byId('email').className = 'login-input is-invalid';
    byId('password').className = 'login-input is-invalid';
  }

  function clearLoginError() {
    var box = byId('login-error');
    if (box) { box.textContent = ''; }
    byId('email').className = 'login-input';
    byId('password').className = 'login-input';
  }

  function wireLogin() {
    var openers = document.querySelectorAll('[data-open-login]');
    var closers = document.querySelectorAll('[data-close-login]');
    var i;

    for (i = 0; i < openers.length; i++) {
      openers[i].addEventListener('click', function () {
        clearLoginError();
        open('login-modal');
        var email = byId('email');
        if (email) { email.focus(); }
      });
    }
    for (i = 0; i < closers.length; i++) {
      closers[i].addEventListener('click', function () { close('login-modal'); });
    }

    var form = byId('login-form');
    if (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        clearLoginError();

        var mail = byId('email').value;
        var pass = byId('password').value;

        if (mail.replace(/^\s+|\s+$/g, '') === '' || pass === '') {
          loginError('Enter your email and password.');
          return;
        }

        var result = R.auth.login(mail, pass);
        if (!result.ok) {
          loginError('That email and password do not match an account.');
          byId('password').value = '';
          byId('password').focus();
          return;
        }

        var next = safeNext(queryParam('next'));
        window.location.href = next || R.auth.homeFor(result.user.role);
      });
    }

    byId('email').addEventListener('input', clearLoginError);
    byId('password').addEventListener('input', clearLoginError);

    var grid = byId('demo-grid');
    if (grid) {
      var rows = grid.querySelectorAll('[data-email]');
      for (i = 0; i < rows.length; i++) {
        rows[i].addEventListener('click', function () {
          byId('email').value = this.getAttribute('data-email') || '';
          byId('password').value = this.getAttribute('data-pass') || '';
          clearLoginError();
          byId('password').focus();
        });
      }
    }
  }

  /* -------------------------------------------------- report cards ------ */

  function renderCards() {
    var host = byId('report-cards');
    if (!host) { return; }

    var brands = R.report.listBrands();
    var html = '';
    var i;

    for (i = 0; i < brands.length; i++) {
      var b = brands[i];
      html +=
        '<div class="report-card">' +
          '<div class="report-card-top">' +
            '<span class="report-dot" style="background:' + b.color + '"></span>' +
            '<span class="report-card-name">' + U.escapeHtml(b.name) + '</span>' +
          '</div>' +
          '<div class="report-card-sub">Weekly sampling results</div>' +
          '<div class="report-lock">Password required</div>' +
          (b.hasData
            ? '<button class="btn btn-primary" type="button" data-report="' + U.escapeHtml(b.id) + '">View report</button>'
            : '<button class="btn" type="button" disabled>No results yet</button>') +
        '</div>';
    }

    host.innerHTML = html;

    var buttons = host.querySelectorAll('[data-report]');
    for (i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function () {
        openGate(this.getAttribute('data-report'));
      });
    }
  }

  /* ------------------------------------------------------------ gate ---- */

  function openGate(brandId) {
    var brand = R.db.byId('brands', brandId);
    if (!brand) { return; }
    pendingBrandId = brandId;

    byId('gate-title').textContent = brand.name + ' report';
    byId('gate-error').textContent = '';
    var field = byId('gate-password');
    field.value = '';
    field.className = 'login-input';

    open('gate-modal');
    field.focus();
  }

  function wireGate() {
    var closers = document.querySelectorAll('[data-close-gate]');
    var i;
    for (i = 0; i < closers.length; i++) {
      closers[i].addEventListener('click', function () {
        pendingBrandId = null;
        close('gate-modal');
      });
    }

    var form = byId('gate-form');
    if (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var field = byId('gate-password');

        if (!pendingBrandId || !R.report.checkPassword(pendingBrandId, field.value)) {
          // Wrong password reveals nothing and does not close the modal.
          byId('gate-error').textContent = 'That password does not open this report.';
          field.className = 'login-input is-invalid';
          field.value = '';
          field.focus();
          return;
        }

        var id = pendingBrandId;
        pendingBrandId = null;
        close('gate-modal');
        openReport(id);
      });
    }

    byId('gate-password').addEventListener('input', function () {
      byId('gate-error').textContent = '';
      this.className = 'login-input';
    });
  }

  /* ---------------------------------------------------------- report ---- */

  function openReport(brandId) {
    var data = R.report.build(brandId);
    if (!data) { return; }

    byId('report-title').textContent = data.brand.name + ' - weekly sampling results';

    var body = byId('report-body');

    if (data.empty) {
      body.innerHTML = '<div class="empty"><div class="empty-text">No sales recorded for this brand yet.</div></div>';
      open('report-modal');
      return;
    }

    var html =
      '<div class="rep-hero">' +
        '<div class="rep-hero-num">' + data.total.toLocaleString() + '</div>' +
        '<div class="rep-hero-label">units sampled &middot; ' + U.escapeHtml(data.rangeLabel) + '</div>' +
      '</div>' +

      '<div class="rep-block">' +
        '<div class="rep-title">Units per day</div>' +
        R.report.daysChartSvg(data) +
      '</div>' +

      '<div class="rep-block">' +
        '<div class="rep-title">Product popularity</div>' +
        R.report.productsChartSvg(data) +
      '</div>' +

      '<div class="rep-block">' +
        '<div class="rep-title">By outlet</div>' +
        '<table class="rep-table"><thead><tr>' +
          '<th>Outlet</th><th>Working dates</th><th>Supervisor</th>' +
          '<th class="rep-num">Pax</th><th class="rep-num">Units</th>' +
        '</tr></thead><tbody>';

    var i;
    for (i = 0; i < data.outlets.length; i++) {
      var o = data.outlets[i];
      html +=
        '<tr>' +
          '<td>' + U.escapeHtml(o.outlet) + '</td>' +
          '<td>' + U.escapeHtml(o.dates) + '</td>' +
          '<td>' + U.escapeHtml(o.supervisor) + '</td>' +
          '<td class="rep-num">' + o.pax + '</td>' +
          '<td class="rep-num">' + o.units.toLocaleString() + '</td>' +
        '</tr>';
    }

    html += '</tbody></table></div>' +
      '<div class="rep-note">The week shown is the seven days ending on the most recent ' +
      'recorded sale for this brand. Days without an activation are shown as zero.</div>';

    body.innerHTML = html;
    R.report.attachTips(body);
    open('report-modal');
  }

  function wireReport() {
    var closers = document.querySelectorAll('[data-close-report]');
    var i;
    for (i = 0; i < closers.length; i++) {
      closers[i].addEventListener('click', function () { close('report-modal'); });
    }
  }

  /* ------------------------------------------------------------- init --- */

  function init() {
    // A visitor holding a live session goes straight to their portal.
    var existing = R.auth.current();
    if (existing) {
      window.location.replace(R.auth.homeFor(existing.role));
      return;
    }

    R.auth.consumeWrongPortalFlag();

    wireNav();
    wireLogin();
    renderCards();
    wireGate();
    wireReport();

    // Escape closes whichever modal is on top.
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') { return; }
      close('report-modal');
      close('gate-modal');
      close('login-modal');
    });

    // Clicking the scrim area closes that modal.
    var boxes = ['login-modal', 'gate-modal', 'report-modal'];
    var i;
    for (i = 0; i < boxes.length; i++) {
      (function (id) {
        var el = byId(id);
        if (!el) { return; }
        el.addEventListener('click', function (ev) {
          if (ev.target === el) { close(id); }
        });
      })(boxes[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.RoadCrew);
