/* RoadCrew - js/landing.js
   Artboard 01 behaviour: login submit, role routing, wrong-portal notice.
   Load order on index.html: data.js, util.js, auth.js, landing.js
   -------------------------------------------------------------------------- */

window.RoadCrew = window.RoadCrew || {};

(function (R) {
  'use strict';

  function byId(id) {
    return document.getElementById(id);
  }

  function queryParam(name) {
    var search = '';
    try {
      search = String(window.location.search || '');
    } catch (e) {
      return null;
    }
    if (search.charAt(0) === '?') {
      search = search.slice(1);
    }
    if (search === '') {
      return null;
    }
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

  // Only accept a same-site relative page as the post-login destination.
  function safeNext(value) {
    if (!value) {
      return null;
    }
    if (value.indexOf('//') !== -1 || value.charAt(0) === '/' || value.indexOf(':') !== -1) {
      return null;
    }
    if (value.indexOf('..') !== -1) {
      return null;
    }
    return /\.html($|\?)/.test(value) ? value : null;
  }

  function destinationFor(user) {
    var next = safeNext(queryParam('next'));
    if (next) {
      return next;
    }
    return R.auth.homeFor(user.role);
  }

  function showError(message) {
    var box = byId('login-error');
    var email = byId('email');
    var password = byId('password');
    if (box) {
      box.textContent = message;
    }
    if (email) {
      email.className = 'login-input is-invalid';
    }
    if (password) {
      password.className = 'login-input is-invalid';
    }
  }

  function clearError() {
    var box = byId('login-error');
    var email = byId('email');
    var password = byId('password');
    if (box) {
      box.textContent = '';
    }
    if (email) {
      email.className = 'login-input';
    }
    if (password) {
      password.className = 'login-input';
    }
  }

  function init() {
    // A visitor who still holds a valid session skips the login card entirely.
    var existing = R.auth.current();
    if (existing) {
      window.location.replace(R.auth.homeFor(existing.role));
      return;
    }

    // "You are signed in as staff" notice after a wrong-portal bounce.
    R.auth.consumeWrongPortalFlag();

    var form = byId('login-form');
    var email = byId('email');
    var password = byId('password');

    if (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        clearError();

        var mail = email ? email.value : '';
        var pass = password ? password.value : '';

        if (mail.replace(/^\s+|\s+$/g, '') === '' || pass === '') {
          showError('Enter your email and password.');
          return;
        }

        var result = R.auth.login(mail, pass);
        if (!result.ok) {
          showError('That email and password do not match an account.');
          if (password) {
            password.value = '';
            password.focus();
          }
          return;
        }

        window.location.href = destinationFor(result.user);
      });
    }

    if (email) {
      email.addEventListener('input', clearError);
    }
    if (password) {
      password.addEventListener('input', clearError);
    }

    // Tapping a demo account fills the form so the boss can click straight through.
    var grid = byId('demo-grid');
    if (grid) {
      var rows = grid.querySelectorAll('[data-email]');
      var i;
      for (i = 0; i < rows.length; i++) {
        rows[i].addEventListener('click', function (ev) {
          var el = ev.currentTarget;
          if (email) {
            email.value = el.getAttribute('data-email') || '';
          }
          if (password) {
            password.value = el.getAttribute('data-pass') || '';
          }
          clearError();
          if (password) {
            password.focus();
          }
        });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.RoadCrew);
