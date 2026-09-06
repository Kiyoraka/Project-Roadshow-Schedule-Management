/* RoadCrew - js/landing.js
   Public landing page behaviour: nav, live hero stat, stat strip, lightbox,
   login modal, report password gate, report, footer.
   Load order on index.html: data.js, util.js, auth.js, report.js, landing.js
   -------------------------------------------------------------------------- */

window.RoadCrew = window.RoadCrew || {};

(function (R) {
  'use strict';

  var U = R.util;
  var pendingBrandId = null;   // brand awaiting its password
  var shots = [];              // gallery entries for the lightbox
  var shotIndex = 0;

  function byId(id) { return document.getElementById(id); }

  // Scroll to a section, and make sure it actually happened.
  //
  // css/landing.css sets scroll-behavior:smooth on the root, so this animates in a
  // normal browser and honours each section's scroll-margin-top. But some
  // environments accept a smooth scroll and then never perform it - an automated
  // Chrome does exactly that - which would leave every nav link silently inert.
  // If nothing has moved shortly afterwards, jump instead. A link that does nothing
  // is a far worse outcome than one that arrives without animating.
  function goTo(target) {
    var before = window.pageYOffset;
    target.scrollIntoView({ block: 'start' });

    window.setTimeout(function () {
      if (Math.abs(window.pageYOffset - before) > 2) { return; }
      var root = document.documentElement;
      var prev = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      target.scrollIntoView({ block: 'start' });
      root.style.scrollBehavior = prev;
    }, 250);
  }

  function open(id) {
    var el = byId(id);
    if (el) { el.className = el.className.replace(/\s*is-open/, '') + ' is-open'; }
  }
  function close(id) {
    var el = byId(id);
    if (el) { el.className = el.className.replace(/\s*is-open/, ''); }
  }

  function wireAnchor(el) {
    el.addEventListener('click', function (ev) {
      var href = this.getAttribute('href') || '';
      if (href.charAt(0) !== '#') { return; }
      var target = document.getElementById(href.slice(1));
      if (!target) { return; }
      ev.preventDefault();
      goTo(target);
    });
  }

  /* ------------------------------------------------------------ nav ----- */

  // Toggle the flag without rebuilding the class string, so a tab keeps
  // whichever base class it was authored with.
  function setActive(el, on) {
    var base = el.className.replace(/\s*is-active/g, '');
    el.className = on ? base + ' is-active' : base;
  }

  function wireNav() {
    // The desktop links and the phone tab bar are one navigation: same targets,
    // same scroll behaviour, highlighted together by the one spy below.
    var items = document.querySelectorAll('.nav-link, .botnav-item[href]');
    var i;
    for (i = 0; i < items.length; i++) { wireAnchor(items[i]); }

    // Any other in-page anchor - hero "See a report", footer links.
    var extra = document.querySelectorAll('[data-scroll], .footer-link[href^="#"]');
    for (i = 0; i < extra.length; i++) { wireAnchor(extra[i]); }

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
        setActive(items[j], items[j].getAttribute('href') === '#' + best);
      }
    }
    window.addEventListener('scroll', spy);
    spy();
  }

  /* ------------------------------------------------- hero + stat strip --- */

  // Everything here is read from the store, so the numbers stay true as data
  // changes rather than going stale in the markup.
  function renderHero() {
    var sales = R.db.sales();
    var units = 0;
    var i;
    for (i = 0; i < sales.length; i++) { units += sales[i].units || 0; }

    var num = byId('hero-stat-units');
    var sub = byId('hero-stat-sub');
    if (num) { num.textContent = units.toLocaleString(); }
    if (sub) {
      sub.textContent = R.db.schedules().length + ' schedules · ' +
                        R.db.outlets().length + ' outlets';
    }

    var host = byId('hero-clients');
    if (host) {
      var brands = R.db.brands();
      var html = '';
      for (i = 0; i < brands.length; i++) {
        html += '<span class="hero-client">' +
                  '<span class="hero-client-dot" style="background:' + brands[i].color + '"></span>' +
                  U.escapeHtml(brands[i].name) +
                '</span>';
      }
      host.innerHTML = html;
    }
  }

  function renderStats() {
    var host = byId('stats');
    if (!host) { return; }

    var users = R.db.users();
    var promoters = 0;
    var i;
    for (i = 0; i < users.length; i++) {
      if (users[i].role === 'staff') { promoters++; }
    }

    var rows = [
      { num: R.db.brands().length,  label: 'Brands' },
      { num: R.db.outlets().length, label: 'Outlets' },
      { num: R.db.regions().length, label: 'Regions' },
      { num: promoters,             label: 'Promoters' }
    ];

    var html = '';
    for (i = 0; i < rows.length; i++) {
      html += '<div class="stat">' +
                '<div class="stat-num">' + rows[i].num + '</div>' +
                '<div class="stat-label">' + rows[i].label + '</div>' +
              '</div>';
    }
    host.innerHTML = html;
  }

  /* --------------------------------------------------------- lightbox --- */

  function showShot(index) {
    if (!shots.length) { return; }
    shotIndex = (index + shots.length) % shots.length;
    var img = byId('lightbox-img');
    var cap = byId('lightbox-cap');
    if (img) { img.src = shots[shotIndex].src; img.alt = shots[shotIndex].alt; }
    if (cap) { cap.textContent = shots[shotIndex].caption; }
  }

  function wireLightbox() {
    var tiles = document.querySelectorAll('.shot-tile');
    var i;
    for (i = 0; i < tiles.length; i++) {
      var img = tiles[i].querySelector('img');
      var cap = tiles[i].querySelector('figcaption');
      shots.push({
        src: img ? img.getAttribute('src') : '',
        alt: img ? img.getAttribute('alt') : '',
        caption: cap ? cap.textContent : ''
      });
      tiles[i].addEventListener('click', function () {
        showShot(parseInt(this.getAttribute('data-shot'), 10) || 0);
        open('lightbox');
      });
    }

    var closers = document.querySelectorAll('[data-close-lightbox]');
    for (i = 0; i < closers.length; i++) {
      closers[i].addEventListener('click', function () { close('lightbox'); });
    }
    var prev = document.querySelector('[data-lightbox-prev]');
    var next = document.querySelector('[data-lightbox-next]');
    if (prev) { prev.addEventListener('click', function (ev) { ev.stopPropagation(); showShot(shotIndex - 1); }); }
    if (next) { next.addEventListener('click', function (ev) { ev.stopPropagation(); showShot(shotIndex + 1); }); }

    document.addEventListener('keydown', function (ev) {
      var box = byId('lightbox');
      if (!box || box.className.indexOf('is-open') === -1) { return; }
      if (ev.key === 'ArrowLeft') { showShot(shotIndex - 1); }
      if (ev.key === 'ArrowRight') { showShot(shotIndex + 1); }
    });
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
          // A deactivated account gets the truth rather than "no such account" - the
          // credentials were right, and telling the owner otherwise sends them hunting
          // for a typo that isn't there.
          loginError(result.reason === 'inactive'
            ? 'That account has been deactivated. Ask the coordinator to switch it back on.'
            : 'That email and password do not match an account.');
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

  // A tiny seven-bar sparkline of the brand's week. It is blurred by CSS and
  // sits under a lock, so it hints at the shape of a result without revealing it.
  function sparkSvg(data, color) {
    var W = 140, H = 40, gap = 4;
    var n = data.week.length || 7;
    var barW = (W - gap * (n - 1)) / n;
    var peak = data.peak || 1;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">';
    var i;
    for (i = 0; i < n; i++) {
      var units = data.week[i] ? data.week[i].units : 0;
      var h = Math.max(2, Math.round((units / peak) * (H - 4)));
      svg += '<rect x="' + (i * (barW + gap)).toFixed(1) + '" y="' + (H - h) +
             '" width="' + barW.toFixed(1) + '" height="' + h + '" rx="2" fill="' + color + '"></rect>';
    }
    return svg + '</svg>';
  }

  var LOCK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="4" y="11" width="16" height="10" rx="2"></rect>' +
    '<path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>';

  function renderCards() {
    var host = byId('report-cards');
    if (!host) { return; }

    var brands = R.report.listBrands();
    var html = '';
    var i;

    for (i = 0; i < brands.length; i++) {
      var b = brands[i];
      var teaser = '';
      if (b.hasData) {
        var data = R.report.build(b.id);
        if (data && !data.empty) {
          teaser = '<div class="report-teaser">' + sparkSvg(data, b.color) +
                   '<div class="report-teaser-lock">' + LOCK_SVG + '</div></div>';
        }
      }

      html +=
        '<div class="report-card" style="--rc:' + b.color + '">' +
          '<div class="report-card-top">' +
            '<span class="report-dot" style="background:' + b.color + '"></span>' +
            '<span class="report-card-name">' + U.escapeHtml(b.name) + '</span>' +
          '</div>' +
          '<div class="report-card-sub">Weekly sampling results</div>' +
          teaser +
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

  /* ----------------------------------------------------------- footer --- */

  // Contact details come from Settings rather than being written into the markup,
  // so editing the company profile updates the public footer too.
  function renderFooter() {
    var s = R.db.settings() || {};
    var email = byId('footer-email');
    var phone = byId('footer-phone');
    var copy = byId('footer-copy');
    var cta = byId('footer-cta-mail');

    if (email && s.contactEmail) {
      email.textContent = s.contactEmail;
      email.setAttribute('href', 'mailto:' + s.contactEmail);
    }
    if (cta && s.contactEmail) {
      cta.setAttribute('href', 'mailto:' + s.contactEmail + '?subject=' +
        encodeURIComponent('Roadshow enquiry'));
    }
    if (phone && s.contactPhone) {
      phone.textContent = s.contactPhone;
      phone.setAttribute('href', 'tel:' + s.contactPhone.replace(/[^0-9+]/g, ''));
    }
    if (copy) {
      var year = R.util.fromISO(R.util.todayISO()).getFullYear();
      copy.textContent = '© ' + year + ' ' +
        (s.companyName || 'RoadCrew Activations') + '. All rights reserved.';
    }

    // Client chips follow the brand list rather than naming two by hand, so adding
    // a brand in Settings shows up here without an edit.
    var chips = byId('footer-chips');
    if (chips) {
      var brands = R.db.brands();
      var html = '';
      var i;
      for (i = 0; i < brands.length; i++) {
        html += '<span class="footer-chip">' + U.escapeHtml(brands[i].name) + '</span>';
      }
      chips.innerHTML = html;
    }
  }

  /* ------------------------------------------------------------- init --- */

  function init() {
    // A visitor holding a live session goes straight to their portal. A role with no
    // portal stays here instead - homeFor would hand back this very page, and replacing
    // the page with itself on every load is an unbreakable reload loop.
    var existing = R.auth.current();
    if (existing && R.auth.hasPortal(existing.role)) {
      window.location.replace(R.auth.homeFor(existing.role));
      return;
    }

    R.auth.consumeWrongPortalFlag();

    wireNav();
    renderHero();
    renderStats();
    wireLightbox();
    wireLogin();
    renderCards();
    renderFooter();
    wireGate();
    wireReport();

    // Escape closes whichever modal is on top.
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') { return; }
      close('lightbox');
      close('report-modal');
      close('gate-modal');
      close('login-modal');
    });

    // Clicking the scrim area closes that modal.
    var boxes = ['lightbox', 'login-modal', 'gate-modal', 'report-modal'];
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
