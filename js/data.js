window.RoadCrew = window.RoadCrew || {};
(function (R) {
  'use strict';

  var DB_KEY = 'roadcrew.db';
  var SESSION_KEY_HINT = 'roadcrew.session';

  var SEED = {
    regions: [
      { id: 'r-central', name: 'Central' },
      { id: 'r-south', name: 'Southern' },
      { id: 'r-east', name: 'East Coast' }
    ],
    // reportPassword gates the public sales report on the landing page. It is checked in
    // the browser, so it is a presentation gate, not access control - nothing sensitive
    // sits behind it. Editable per brand from admin Settings.
    brands: [
      { id: 'b-kapalapi', name: 'Kapal Api', color: '#C0392B', reportPassword: 'kapalapi2026' },
      { id: 'b-jasmine', name: 'Jasmine', color: '#2E8B57', reportPassword: 'jasmine2026' }
    ],
    outlets: [
      { id: 'o-01', name: 'Pasaraya U All Mart', regionId: 'r-east', city: 'Pasir Mas' },
      { id: 'o-02', name: 'PKT Gua Musang', regionId: 'r-east', city: 'Gua Musang' },
      { id: 'o-03', name: 'Econjaya Machang', regionId: 'r-east', city: 'Machang' },
      { id: 'o-04', name: 'Sabasun Kuala Terengganu', regionId: 'r-east', city: 'Kuala Terengganu' },
      { id: 'o-05', name: 'Sabasun Wakaf Tembesu', regionId: 'r-east', city: 'Kuala Terengganu' },
      { id: 'o-06', name: 'Arena Teraju Mart', regionId: 'r-east', city: 'Kuantan' },
      { id: 'o-07', name: 'KY Maju Sg Soi', regionId: 'r-east', city: 'Kuantan' },
      { id: 'o-08', name: 'St. Rosyam Tampoi (Booth)', regionId: 'r-south', city: 'Johor Bahru' },
      { id: 'o-09', name: "Lotus's Setia Tropika", regionId: 'r-south', city: 'Johor Bahru' },
      { id: 'o-10', name: "Lotus's Kepong", regionId: 'r-central', city: 'Kuala Lumpur' },
      { id: 'o-11', name: "Lotus's Seremban", regionId: 'r-central', city: 'Seremban' },
      { id: 'o-12', name: 'St. Rosyam Senawang', regionId: 'r-central', city: 'Seremban' },
      { id: 'o-13', name: 'Hero Subang', regionId: 'r-central', city: 'Subang Jaya' },
      { id: 'o-14', name: 'Jaya Grocer Sunway Pyramid', regionId: 'r-central', city: 'Petaling Jaya' }
    ],
    users: [
      { id: 'u-admin', name: 'Coordinator', email: 'admin@gmail.com', password: 'admin123', role: 'admin', regionId: null, phone: '012-000 0000', status: 'active', avatar: 'img/avatar-01.svg' },
      { id: 'u-01', name: 'Airene', email: 'staff1@gmail.com', password: 'admin123', role: 'staff', regionId: 'r-east', phone: '013-101 1001', status: 'active', avatar: 'img/avatar-02.svg' },
      { id: 'u-02', name: 'Chrisnie', email: 'chrisnie@roadcrew.demo', password: 'admin123', role: 'staff', regionId: 'r-south', phone: '013-102 1002', status: 'active', avatar: 'img/avatar-03.svg' },
      { id: 'u-03', name: 'Elizabeth', email: 'elizabeth@roadcrew.demo', password: 'admin123', role: 'staff', regionId: 'r-central', phone: '013-103 1003', status: 'active', avatar: 'img/avatar-04.svg' },
      { id: 'u-04', name: 'Johnny', email: 'staff2@gmail.com', password: 'admin123', role: 'staff', regionId: 'r-central', phone: '013-104 1004', status: 'active', avatar: 'img/avatar-05.svg' },
      { id: 'u-05', name: 'Rou Qian', email: 'rouqian@roadcrew.demo', password: 'admin123', role: 'staff', regionId: 'r-east', phone: '013-105 1005', status: 'active', avatar: 'img/avatar-06.svg' },
      { id: 'u-06', name: 'Ying Zhi', email: 'yingzhi@roadcrew.demo', password: 'admin123', role: 'staff', regionId: 'r-east', phone: '013-106 1006', status: 'active', avatar: 'img/avatar-07.svg' },
      { id: 'u-07', name: 'Yong Lok', email: 'yonglok@roadcrew.demo', password: 'admin123', role: 'staff', regionId: 'r-central', phone: '013-107 1007', status: 'inactive', avatar: 'img/avatar-08.svg' }
    ],
    schedules: [
      { id: 's-01', brandId: 'b-kapalapi', outletId: 'o-10', spIds: ['u-03'], startDate: '2026-07-05', endDate: '2026-07-06', shift: '10:00 – 18:00', status: 'planned', notes: '' },
      { id: 's-02', brandId: 'b-kapalapi', outletId: 'o-04', spIds: ['u-05'], startDate: '2026-07-16', endDate: '2026-07-18', shift: '10:00 – 18:00', status: 'planned', notes: '' },
      { id: 's-03', brandId: 'b-kapalapi', outletId: 'o-06', spIds: ['u-05'], startDate: '2026-07-17', endDate: '2026-07-17', shift: '10:00 – 18:00', status: 'planned', notes: 'Overlaps Sabasun KT on purpose (conflict sample)' },
      { id: 's-04', brandId: 'b-kapalapi', outletId: 'o-01', spIds: ['u-01'], startDate: '2026-07-23', endDate: '2026-07-25', shift: '10:00 – 18:00', status: 'planned', notes: '' },
      { id: 's-05', brandId: 'b-kapalapi', outletId: 'o-11', spIds: ['u-04'], startDate: '2026-07-27', endDate: '2026-07-27', shift: '10:00 – 18:00', status: 'planned', notes: '' },
      { id: 's-06', brandId: 'b-kapalapi', outletId: 'o-05', spIds: ['u-05'], startDate: '2026-07-30', endDate: '2026-08-01', shift: '10:00 – 18:00', status: 'planned', notes: '' },
      { id: 's-07', brandId: 'b-kapalapi', outletId: 'o-09', spIds: ['u-02'], startDate: '2026-08-03', endDate: '2026-08-04', shift: '10:00 – 18:00', status: 'planned', notes: '' },
      { id: 's-08', brandId: 'b-kapalapi', outletId: 'o-02', spIds: ['u-01'], startDate: '2026-08-12', endDate: '2026-08-14', shift: '10:00 – 18:00', status: 'planned', notes: '' },
      { id: 's-09', brandId: 'b-jasmine', outletId: 'o-14', spIds: ['u-03', 'u-07'], startDate: '2026-08-27', endDate: '2026-08-31', shift: '10:00 – 22:00', status: 'planned', notes: 'Jasmine Muhibbah Roadshow, concourse booth, sampling + games' },
      { id: 's-10', brandId: 'b-kapalapi', outletId: 'o-13', spIds: ['u-07'], startDate: '2026-08-28', endDate: '2026-08-30', shift: '10:00 – 18:00', status: 'cancelled', notes: 'Outlet postponed' },
      { id: 's-11', brandId: 'b-kapalapi', outletId: 'o-07', spIds: ['u-06'], startDate: '2026-08-29', endDate: '2026-08-29', shift: '10:00 – 18:00', status: 'planned', notes: '' },
      { id: 's-12', brandId: 'b-kapalapi', outletId: 'o-03', spIds: ['u-01'], startDate: '2026-09-04', endDate: '2026-09-05', shift: '10:00 – 18:00', status: 'planned', notes: '' },
      { id: 's-13', brandId: 'b-kapalapi', outletId: 'o-12', spIds: ['u-04'], startDate: '2026-09-04', endDate: '2026-09-06', shift: '10:00 – 18:00', status: 'planned', notes: '' },
      { id: 's-14', brandId: 'b-kapalapi', outletId: 'o-08', spIds: ['u-02'], startDate: '2026-09-12', endDate: '2026-09-12', shift: '10:00 – 18:00', status: 'planned', notes: '' },
      { id: 's-15', brandId: 'b-jasmine', outletId: 'o-14', spIds: [], startDate: '2026-09-19', endDate: '2026-09-20', shift: '10:00 – 18:00', status: 'planned', notes: 'Unassigned sample, needs a promoter' }
    ],
    checkins: [
      { id: 'c-01', scheduleId: 's-09', userId: 'u-03', date: '2026-08-27', time: '10:05', photo: 'img/checkin-01.svg', note: 'Booth set up, sampling started' },
      { id: 'c-02', scheduleId: 's-09', userId: 'u-03', date: '2026-08-28', time: '10:12', photo: 'img/checkin-02.svg', note: 'Water-ratio game running' },
      { id: 'c-03', scheduleId: 's-09', userId: 'u-03', date: '2026-08-29', time: '09:58', photo: 'img/checkin-03.svg', note: 'Weekend crowd, blind box popular' },
      { id: 'c-04', scheduleId: 's-09', userId: 'u-07', date: '2026-08-30', time: '10:20', photo: 'img/checkin-04.svg', note: '' },
      { id: 'c-05', scheduleId: 's-09', userId: 'u-03', date: '2026-08-31', time: '10:03', photo: 'img/checkin-05.svg', note: 'Last day, stock low on Pusa Cream 5kg' },
      { id: 'c-06', scheduleId: 's-12', userId: 'u-01', date: '2026-09-04', time: '10:09', photo: 'img/checkin-06.svg', note: 'Econjaya entrance booth' },
      // c-07 and c-08 are not in the written brief. They were added on Kiyo's call so the
      // promoter screens carry the content their artboards depict: artboard 06 names this
      // note and time, and artboard 07 shows a third photo at PKT Gua Musang on 14 Aug.
      // Both sit inside schedules Airene genuinely holds - s-12 (4-5 Sep) and s-08 (12-14 Aug).
      { id: 'c-07', scheduleId: 's-12', userId: 'u-01', date: '2026-09-05', time: '10:12', photo: 'img/checkin-02.svg', note: 'Day 2, sampling running' },
      { id: 'c-08', scheduleId: 's-08', userId: 'u-01', date: '2026-08-14', time: '10:05', photo: 'img/checkin-04.svg', note: '' }
    ],

    // Products and sales back the gated brand report on the landing page. The design brief
    // put sales capture out of scope, so none of this existed until the report was asked for.
    products: [
      { id: 'p-ka-01', brandId: 'b-kapalapi', name: 'Special Mix' },
      { id: 'p-ka-02', brandId: 'b-kapalapi', name: 'Grande White Coffee' },
      { id: 'p-ka-03', brandId: 'b-kapalapi', name: 'Susu' },
      { id: 'p-ka-04', brandId: 'b-kapalapi', name: 'Kopi O' },
      { id: 'p-js-01', brandId: 'b-jasmine', name: 'Pusa Cream 5kg' },
      { id: 'p-js-02', brandId: 'b-jasmine', name: 'Fragrant Rice 5kg' },
      { id: 'p-js-03', brandId: 'b-jasmine', name: 'Basmati 1kg' },
      { id: 'p-js-04', brandId: 'b-jasmine', name: 'Super Special 10kg' }
    ],

    // Every row keys on scheduleId, never on a promoter or a date range, so the reference
    // survives the Stage 2 move to supervisorId + pax + dates[].
    // Kapal Api: s-12 Econjaya Machang (4-5 Sep) and s-13 St. Rosyam Senawang (4-6 Sep).
    // Jasmine:   s-09 Jaya Grocer Sunway Pyramid (27-31 Aug). Pusa Cream leads the week and
    //            then collapses on the 31st, which is what check-in c-05 reports that day:
    //            "Last day, stock low on Pusa Cream 5kg".
    sales: [
      { id: 'sa-01', scheduleId: 's-12', productId: 'p-ka-01', date: '2026-09-04', units: 62 },
      { id: 'sa-02', scheduleId: 's-12', productId: 'p-ka-02', date: '2026-09-04', units: 41 },
      { id: 'sa-03', scheduleId: 's-12', productId: 'p-ka-03', date: '2026-09-04', units: 28 },
      { id: 'sa-04', scheduleId: 's-12', productId: 'p-ka-04', date: '2026-09-04', units: 15 },
      { id: 'sa-05', scheduleId: 's-12', productId: 'p-ka-01', date: '2026-09-05', units: 78 },
      { id: 'sa-06', scheduleId: 's-12', productId: 'p-ka-02', date: '2026-09-05', units: 52 },
      { id: 'sa-07', scheduleId: 's-12', productId: 'p-ka-03', date: '2026-09-05', units: 33 },
      { id: 'sa-08', scheduleId: 's-12', productId: 'p-ka-04', date: '2026-09-05', units: 19 },
      { id: 'sa-09', scheduleId: 's-13', productId: 'p-ka-01', date: '2026-09-04', units: 54 },
      { id: 'sa-10', scheduleId: 's-13', productId: 'p-ka-02', date: '2026-09-04', units: 37 },
      { id: 'sa-11', scheduleId: 's-13', productId: 'p-ka-03', date: '2026-09-04', units: 24 },
      { id: 'sa-12', scheduleId: 's-13', productId: 'p-ka-04', date: '2026-09-04', units: 12 },
      { id: 'sa-13', scheduleId: 's-13', productId: 'p-ka-01', date: '2026-09-05', units: 69 },
      { id: 'sa-14', scheduleId: 's-13', productId: 'p-ka-02', date: '2026-09-05', units: 45 },
      { id: 'sa-15', scheduleId: 's-13', productId: 'p-ka-03', date: '2026-09-05', units: 30 },
      { id: 'sa-16', scheduleId: 's-13', productId: 'p-ka-04', date: '2026-09-05', units: 17 },
      { id: 'sa-17', scheduleId: 's-13', productId: 'p-ka-01', date: '2026-09-06', units: 46 },
      { id: 'sa-18', scheduleId: 's-13', productId: 'p-ka-02', date: '2026-09-06', units: 31 },
      { id: 'sa-19', scheduleId: 's-13', productId: 'p-ka-03', date: '2026-09-06', units: 21 },
      { id: 'sa-20', scheduleId: 's-13', productId: 'p-ka-04', date: '2026-09-06', units: 11 },
      { id: 'sa-21', scheduleId: 's-09', productId: 'p-js-01', date: '2026-08-27', units: 34 },
      { id: 'sa-22', scheduleId: 's-09', productId: 'p-js-02', date: '2026-08-27', units: 29 },
      { id: 'sa-23', scheduleId: 's-09', productId: 'p-js-03', date: '2026-08-27', units: 18 },
      { id: 'sa-24', scheduleId: 's-09', productId: 'p-js-04', date: '2026-08-27', units: 11 },
      { id: 'sa-25', scheduleId: 's-09', productId: 'p-js-01', date: '2026-08-28', units: 47 },
      { id: 'sa-26', scheduleId: 's-09', productId: 'p-js-02', date: '2026-08-28', units: 38 },
      { id: 'sa-27', scheduleId: 's-09', productId: 'p-js-03', date: '2026-08-28', units: 23 },
      { id: 'sa-28', scheduleId: 's-09', productId: 'p-js-04', date: '2026-08-28', units: 14 },
      { id: 'sa-29', scheduleId: 's-09', productId: 'p-js-01', date: '2026-08-29', units: 66 },
      { id: 'sa-30', scheduleId: 's-09', productId: 'p-js-02', date: '2026-08-29', units: 55 },
      { id: 'sa-31', scheduleId: 's-09', productId: 'p-js-03', date: '2026-08-29', units: 31 },
      { id: 'sa-32', scheduleId: 's-09', productId: 'p-js-04', date: '2026-08-29', units: 20 },
      { id: 'sa-33', scheduleId: 's-09', productId: 'p-js-01', date: '2026-08-30', units: 71 },
      { id: 'sa-34', scheduleId: 's-09', productId: 'p-js-02', date: '2026-08-30', units: 58 },
      { id: 'sa-35', scheduleId: 's-09', productId: 'p-js-03', date: '2026-08-30', units: 34 },
      { id: 'sa-36', scheduleId: 's-09', productId: 'p-js-04', date: '2026-08-30', units: 22 },
      { id: 'sa-37', scheduleId: 's-09', productId: 'p-js-01', date: '2026-08-31', units: 28 },
      { id: 'sa-38', scheduleId: 's-09', productId: 'p-js-02', date: '2026-08-31', units: 33 },
      { id: 'sa-39', scheduleId: 's-09', productId: 'p-js-03', date: '2026-08-31', units: 19 },
      { id: 'sa-40', scheduleId: 's-09', productId: 'p-js-04', date: '2026-08-31', units: 12 }
    ],
    settings: {
      companyName: 'RoadCrew Activations',
      contactEmail: 'hello@roadcrew.demo',
      contactPhone: '03-0000 0000',
      logo: null,
      checkin: { photoRequired: true, windowStart: '09:00', windowEnd: '19:00', maxPhotos: 3 }
    }
  };

  // In-memory fallback used when localStorage is unavailable or throws
  // (private browsing, file:// edge cases, quota errors).
  var memoryState = null;
  var storageBroken = false;

  function deepCopy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readRaw() {
    if (storageBroken) { return null; }
    try {
      return window.localStorage.getItem(DB_KEY);
    } catch (e) {
      storageBroken = true;
      return null;
    }
  }

  function writeRaw(text) {
    if (storageBroken) { return false; }
    try {
      window.localStorage.setItem(DB_KEY, text);
      return true;
    } catch (e) {
      storageBroken = true;
      return false;
    }
  }

  function removeRaw(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      storageBroken = true;
    }
  }

  function isValidState(state) {
    return !!state &&
      typeof state === 'object' &&
      Object.prototype.toString.call(state.regions) === '[object Array]' &&
      Object.prototype.toString.call(state.brands) === '[object Array]' &&
      Object.prototype.toString.call(state.outlets) === '[object Array]' &&
      Object.prototype.toString.call(state.users) === '[object Array]' &&
      Object.prototype.toString.call(state.schedules) === '[object Array]' &&
      Object.prototype.toString.call(state.checkins) === '[object Array]' &&
      !!state.settings;
  }

  function save(state) {
    memoryState = state;
    var text;
    try {
      text = JSON.stringify(state);
    } catch (e) {
      return state;
    }
    writeRaw(text);
    return state;
  }

  function load() {
    var raw = readRaw();
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (isValidState(parsed)) {
          memoryState = parsed;
          return parsed;
        }
      } catch (e) {
        // corrupt payload, fall through to seeding
      }
    }
    if (raw === null && memoryState && isValidState(memoryState)) {
      // storage is unavailable but we already hold a working copy
      return memoryState;
    }
    var fresh = deepCopy(SEED);
    return save(fresh);
  }

  function reset() {
    memoryState = null;
    removeRaw(DB_KEY);
    removeRaw(SESSION_KEY_HINT);
  }

  function collection(name) {
    var state = load();
    var list = state[name];
    if (Object.prototype.toString.call(list) !== '[object Array]') {
      list = [];
      state[name] = list;
    }
    return list;
  }

  function byId(collectionName, id) {
    var list = collection(collectionName);
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (list[i] && list[i].id === id) {
        return list[i];
      }
    }
    return null;
  }

  function upsert(collectionName, record) {
    var state = load();
    var list = state[collectionName];
    if (Object.prototype.toString.call(list) !== '[object Array]') {
      list = [];
      state[collectionName] = list;
    }
    var replaced = false;
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (list[i] && record && list[i].id === record.id) {
        list[i] = record;
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      list.push(record);
    }
    save(state);
    return record;
  }

  function remove(collectionName, id) {
    var state = load();
    var list = state[collectionName];
    if (Object.prototype.toString.call(list) !== '[object Array]') {
      return false;
    }
    var removed = false;
    var i;
    for (i = list.length - 1; i >= 0; i -= 1) {
      if (list[i] && list[i].id === id) {
        list.splice(i, 1);
        removed = true;
      }
    }
    if (removed) {
      save(state);
    }
    return removed;
  }

  R.SEED = SEED;

  R.db = {
    DB_KEY: DB_KEY,
    SESSION_KEY_HINT: SESSION_KEY_HINT,
    load: load,
    save: save,
    reset: reset,
    regions: function () { return collection('regions'); },
    brands: function () { return collection('brands'); },
    outlets: function () { return collection('outlets'); },
    users: function () { return collection('users'); },
    schedules: function () { return collection('schedules'); },
    checkins: function () { return collection('checkins'); },
    products: function () { return collection('products'); },
    sales: function () { return collection('sales'); },
    settings: function () { return load().settings; },
    byId: byId,
    upsert: upsert,
    remove: remove
  };
})(window.RoadCrew);
