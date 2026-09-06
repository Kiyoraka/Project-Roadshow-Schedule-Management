window.RoadCrew = window.RoadCrew || {};

(function (R) {
  'use strict';

  var SESSION_KEY = 'roadcrew.session';
  var THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  // Directories that sit one level below the repo root.
  var NESTED_DIRS = { admin: true, staff: true };

  // ---------------------------------------------------------------------
  // Storage (localStorage with in-memory fallback, same shape as data.js)
  // ---------------------------------------------------------------------

  var memoryStore = {};

  function storageRead(key) {
    try {
      var raw = window.localStorage.getItem(key);
      if (raw === null || typeof raw === 'undefined') {
        return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
      }
      return raw;
    } catch (e) {
      return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
    }
  }

  function storageWrite(key, value) {
    memoryStore[key] = value;
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      // localStorage unavailable (private mode, file:// restrictions) - memory only.
    }
  }

  function storageRemove(key) {
    delete memoryStore[key];
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      // Ignore - memory copy already dropped.
    }
  }

  // ---------------------------------------------------------------------
  // Relative path helpers (must work from file:// at root and one level deep)
  // ---------------------------------------------------------------------

  function decodeSafe(value) {
    try {
      return decodeURIComponent(value);
    } catch (e) {
      return value;
    }
  }

  function pathSegments() {
    var raw = '';
    try {
      raw = String(window.location.pathname || '');
    } catch (e) {
      raw = '';
    }
    var parts = raw.split('/');
    var out = [];
    var i;
    for (i = 0; i < parts.length; i++) {
      if (parts[i] !== '') {
        out.push(decodeSafe(parts[i]));
      }
    }
    return out;
  }

  function currentFileName() {
    var parts = pathSegments();
    var last = parts.length ? parts[parts.length - 1] : '';
    if (last === '' || last.indexOf('.') === -1) {
      return 'index.html';
    }
    return last;
  }

  function currentDirName() {
    var parts = pathSegments();
    var last = parts.length ? parts[parts.length - 1] : '';
    var dirIndex;
    if (last === '' || last.indexOf('.') === -1) {
      // Directory-style URL - the last segment is itself the folder.
      dirIndex = parts.length - 1;
    } else {
      dirIndex = parts.length - 2;
    }
    if (dirIndex < 0) {
      return '';
    }
    var dir = String(parts[dirIndex] || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(NESTED_DIRS, dir) ? dir : '';
  }

  // Returns '' at the repo root, '../' inside admin/ or staff/.
  function prefix() {
    return currentDirName() === '' ? '' : '../';
  }

  // Current page expressed relative to the repo root, e.g. 'admin/users.html'.
  function currentRelativePath() {
    var dir = currentDirName();
    var file = currentFileName();
    return dir === '' ? file : dir + '/' + file;
  }

  function redirect(url) {
    try {
      window.location.replace(url);
    } catch (e) {
      try {
        window.location.href = url;
      } catch (e2) {
        // Nothing more we can do.
      }
    }
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
      if (pairs[i] === '') {
        continue;
      }
      var eq = pairs[i].indexOf('=');
      var key = eq === -1 ? pairs[i] : pairs[i].slice(0, eq);
      var val = eq === -1 ? '' : pairs[i].slice(eq + 1);
      if (decodeSafe(key.replace(/\+/g, ' ')) === name) {
        return decodeSafe(val.replace(/\+/g, ' '));
      }
    }
    return null;
  }

  function stripQueryParam(name) {
    var search = '';
    try {
      search = String(window.location.search || '');
    } catch (e) {
      return;
    }
    if (search.charAt(0) === '?') {
      search = search.slice(1);
    }
    var pairs = search === '' ? [] : search.split('&');
    var kept = [];
    var i;
    for (i = 0; i < pairs.length; i++) {
      if (pairs[i] === '') {
        continue;
      }
      var eq = pairs[i].indexOf('=');
      var key = eq === -1 ? pairs[i] : pairs[i].slice(0, eq);
      if (decodeSafe(key.replace(/\+/g, ' ')) !== name) {
        kept.push(pairs[i]);
      }
    }
    try {
      if (window.history && typeof window.history.replaceState === 'function') {
        var next = currentFileName() + (kept.length ? '?' + kept.join('&') : '');
        var hash = String(window.location.hash || '');
        window.history.replaceState(null, '', next + hash);
      }
    } catch (e) {
      // file:// may reject replaceState - the flag simply stays in the URL.
    }
  }

  // ---------------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------------

  function readSession() {
    var raw = storageRead(SESSION_KEY);
    if (!raw) {
      return null;
    }
    var session;
    try {
      session = JSON.parse(raw);
    } catch (e) {
      return null;
    }
    if (!session || typeof session !== 'object') {
      return null;
    }
    if (typeof session.userId !== 'string' || session.userId === '') {
      return null;
    }
    if (session.role !== 'admin' && session.role !== 'staff') {
      return null;
    }
    if (typeof session.expiresAt !== 'number' || !isFinite(session.expiresAt)) {
      return null;
    }
    return session;
  }

  function clearSession() {
    storageRemove(SESSION_KEY);
  }

  function writeSession(user) {
    var session = {
      userId: String(user.id),
      role: user.role,
      expiresAt: Date.now() + THIRTY_DAYS_MS
    };
    storageWrite(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  // Returns a validated, non-expired session or null (clearing bad sessions).
  function validSession() {
    var session = readSession();
    if (!session) {
      clearSession();
      return null;
    }
    if (session.expiresAt <= Date.now()) {
      clearSession();
      return null;
    }
    return session;
  }

  function lookupUser(userId) {
    var user = null;
    try {
      user = R.db.byId('users', userId);
    } catch (e) {
      user = null;
    }
    return user || null;
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

  var auth = {};

  auth.SESSION_KEY = SESSION_KEY;

  auth.login = function (email, password) {
    var needle = String(typeof email === 'undefined' || email === null ? '' : email);
    needle = needle.replace(/^\s+|\s+$/g, '').toLowerCase();

    var users = [];
    try {
      users = R.db.users() || [];
    } catch (e) {
      users = [];
    }

    var match = null;
    var i;
    for (i = 0; i < users.length; i++) {
      var candidate = String(users[i] && users[i].email ? users[i].email : '');
      candidate = candidate.replace(/^\s+|\s+$/g, '').toLowerCase();
      if (candidate !== '' && candidate === needle) {
        match = users[i];
        break;
      }
    }

    if (!match) {
      return { ok: false, reason: 'invalid' };
    }
    if (match.password !== password) {
      return { ok: false, reason: 'invalid' };
    }

    writeSession(match);
    return { ok: true, user: match };
  };

  auth.current = function () {
    var session = validSession();
    if (!session) {
      return null;
    }
    var user = lookupUser(session.userId);
    if (!user) {
      clearSession();
      return null;
    }
    return user;
  };

  auth.logout = function () {
    clearSession();
    redirect(prefix() + 'index.html');
  };

  auth.homeFor = function (role) {
    var base = prefix();
    if (role === 'admin') {
      return base + 'admin/dashboard.html';
    }
    if (role === 'staff') {
      return base + 'staff/calendar.html';
    }
    return base + 'index.html';
  };

  auth.requireRole = function (role) {
    var session = validSession();
    var user = session ? lookupUser(session.userId) : null;

    if (!session || !user) {
      clearSession();
      redirect(prefix() + 'index.html?next=' + encodeURIComponent(currentRelativePath()));
      return null;
    }

    if (session.role !== role) {
      redirect(auth.homeFor(session.role) + '?wrongPortal=1');
      return null;
    }

    return user;
  };

  var wrongPortalConsumed = false;

  auth.consumeWrongPortalFlag = function () {
    if (wrongPortalConsumed) {
      return false;
    }
    if (queryParam('wrongPortal') !== '1') {
      return false;
    }
    wrongPortalConsumed = true;

    var session = validSession();
    var role = session ? session.role : 'a guest';

    try {
      R.util.toast('You are signed in as ' + role + '.', 'info');
    } catch (e) {
      // Toast is cosmetic - never let it break the page.
    }

    stripQueryParam('wrongPortal');
    return true;
  };

  R.auth = auth;
})(window.RoadCrew);
