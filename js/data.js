window.RoadCrew = window.RoadCrew || {};
(function (R) {
  'use strict';

  // Bumped from 'roadcrew.db' when regions became a three-level tree. migrate() only
  // ever ADDS what is missing, so it cannot repoint outlets.regionId at the new
  // top-level regions or drop users.regionId in favour of users.subregionId - a stored
  // database would keep both fields and the stale value would win forever. A new key is
  // the clean break: the old payload is ignored and removed, and every record is seeded
  // with the correct shape. Nothing of value is lost - this is a demo whose data is
  // reseedable from Settings > Demo data.
  var DB_KEY = 'roadcrew.db.v2';
  var LEGACY_DB_KEYS = ['roadcrew.db'];
  var SESSION_KEY_HINT = 'roadcrew.session';

  var SEED = {
    // Three levels, on the client's own words: "Add EM means Sabah n sarawak; add
    // Singapore". The flat Central/Southern/East Coast list the demo started with is
    // now the MIDDLE level - those are sub-regions of West Malaysia.
    regions: [
      { id: 'reg-wm', name: 'West Malaysia', code: 'WM' },
      { id: 'reg-em', name: 'East Malaysia', code: 'EM' },
      { id: 'reg-sg', name: 'Singapore', code: 'SG' }
    ],
    // Singapore carries one same-named sub-region rather than hanging outlets straight
    // off the region. Uniform depth means no screen has to special-case a childless
    // region, and the Regions panel can split it later without a migration.
    subregions: [
      { id: 'sr-central', regionId: 'reg-wm', name: 'Central' },
      { id: 'sr-south', regionId: 'reg-wm', name: 'Southern' },
      { id: 'sr-east', regionId: 'reg-wm', name: 'East Coast' },
      { id: 'sr-sabah', regionId: 'reg-em', name: 'Sabah' },
      { id: 'sr-sarawak', regionId: 'reg-em', name: 'Sarawak' },
      { id: 'sr-sg', regionId: 'reg-sg', name: 'Singapore' }
    ],
    // reportPassword gates the public sales report on the landing page. It is checked in
    // the browser, so it is a presentation gate, not access control - nothing sensitive
    // sits behind it. Editable per brand from admin Settings.
    brands: [
      { id: 'b-kapalapi', name: 'Kapal Api', color: '#C0392B', reportPassword: 'kapalapi2026' },
      { id: 'b-jasmine', name: 'Jasmine', color: '#2E8B57', reportPassword: 'jasmine2026' },
      { id: 'b-pocky', name: 'Pocky', color: '#C2185B', reportPassword: 'pocky2026' },
      { id: 'b-kewpie', name: 'Kewpie', color: '#D98F14', reportPassword: 'kewpie2026' }
    ],
    outlets: [
      { id: 'o-01', name: 'Pasaraya U All Mart', subregionId: 'sr-east', city: 'Pasir Mas' },
      { id: 'o-02', name: 'PKT Gua Musang', subregionId: 'sr-east', city: 'Gua Musang' },
      { id: 'o-03', name: 'Econjaya Machang', subregionId: 'sr-east', city: 'Machang' },
      { id: 'o-04', name: 'Sabasun Kuala Terengganu', subregionId: 'sr-east', city: 'Kuala Terengganu' },
      { id: 'o-05', name: 'Sabasun Wakaf Tembesu', subregionId: 'sr-east', city: 'Kuala Terengganu' },
      { id: 'o-06', name: 'Arena Teraju Mart', subregionId: 'sr-east', city: 'Kuantan' },
      { id: 'o-07', name: 'KY Maju Sg Soi', subregionId: 'sr-east', city: 'Kuantan' },
      { id: 'o-08', name: 'St. Rosyam Tampoi (Booth)', subregionId: 'sr-south', city: 'Johor Bahru' },
      { id: 'o-09', name: "Lotus's Setia Tropika", subregionId: 'sr-south', city: 'Johor Bahru' },
      { id: 'o-10', name: "Lotus's Kepong", subregionId: 'sr-central', city: 'Kuala Lumpur' },
      { id: 'o-11', name: "Lotus's Seremban", subregionId: 'sr-central', city: 'Seremban' },
      { id: 'o-12', name: 'St. Rosyam Senawang', subregionId: 'sr-central', city: 'Seremban' },
      { id: 'o-13', name: 'Hero Subang', subregionId: 'sr-central', city: 'Subang Jaya' },
      { id: 'o-14', name: 'Jaya Grocer Sunway Pyramid', subregionId: 'sr-central', city: 'Petaling Jaya' },
      // Named in the client's own mockup, on the Pocky Sampling row.
      { id: 'o-15', name: "Lotus's Setia Alam", subregionId: 'sr-central', city: 'Shah Alam' },
      // PLACEHOLDERS. The client asked for East Malaysia and Singapore but has not
      // sent outlets for either, so these are real chains that actually trade in each
      // territory - Servay and City Grocer in Sabah, Everrise and Ta Kiong in Sarawak,
      // FairPrice and Sheng Siong in Singapore - standing in until Five Senses confirms
      // the real list. Replace before the client sees numbers attached to them.
      { id: 'o-16', name: 'Servay Hypermarket Penampang', subregionId: 'sr-sabah', city: 'Kota Kinabalu' },
      { id: 'o-17', name: 'City Grocer Bundusan', subregionId: 'sr-sabah', city: 'Kota Kinabalu' },
      { id: 'o-18', name: 'Everrise BDC', subregionId: 'sr-sarawak', city: 'Kuching' },
      { id: 'o-19', name: 'Ta Kiong Stutong', subregionId: 'sr-sarawak', city: 'Kuching' },
      { id: 'o-20', name: 'FairPrice Xtra Jurong Point', subregionId: 'sr-sg', city: 'Jurong East' },
      { id: 'o-21', name: 'Sheng Siong Bedok', subregionId: 'sr-sg', city: 'Bedok' }
    ],
    // Three roles. brandId is set on client rows only - it is what scopes the client
    // portal, so an admin or a promoter must carry null rather than a brand they would
    // then appear to own. subregionId is where a person works; the admin covers all.
    //
    // Eleven client-service accounts, because the client said "I have 11 client service
    // team who will do the schedule update". The first four are on @gmail.com and are
    // the ones listed in the landing page demo box, one per brand, so the account grid
    // stays short while the seed stays honest about the headcount.
    users: [
      { id: 'u-admin', name: 'Coordinator', email: 'admin@gmail.com', password: 'admin123', role: 'admin', subregionId: null, brandId: null, phone: '012-000 0000', status: 'active', avatar: 'img/avatar-01.svg' },

      { id: 'u-c01', name: 'Adeline Tan', email: 'client1@gmail.com', password: 'admin123', role: 'client', subregionId: null, brandId: 'b-kapalapi', phone: '012-201 2001', status: 'active', avatar: 'img/avatar-02.svg' },
      { id: 'u-c02', name: 'Farah Idris', email: 'client2@gmail.com', password: 'admin123', role: 'client', subregionId: null, brandId: 'b-jasmine', phone: '012-202 2002', status: 'active', avatar: 'img/avatar-03.svg' },
      { id: 'u-c03', name: 'Marcus Lim', email: 'client3@gmail.com', password: 'admin123', role: 'client', subregionId: null, brandId: 'b-pocky', phone: '012-203 2003', status: 'active', avatar: 'img/avatar-04.svg' },
      { id: 'u-c04', name: 'Nurul Hakim', email: 'client4@gmail.com', password: 'admin123', role: 'client', subregionId: null, brandId: 'b-kewpie', phone: '012-204 2004', status: 'active', avatar: 'img/avatar-05.svg' },
      { id: 'u-c05', name: 'Priya Ramesh', email: 'priya@roadcrew.demo', password: 'admin123', role: 'client', subregionId: null, brandId: 'b-kapalapi', phone: '012-205 2005', status: 'active', avatar: 'img/avatar-06.svg' },
      { id: 'u-c06', name: 'Sook Yee', email: 'sookyee@roadcrew.demo', password: 'admin123', role: 'client', subregionId: null, brandId: 'b-kapalapi', phone: '012-206 2006', status: 'active', avatar: 'img/avatar-07.svg' },
      { id: 'u-c07', name: 'Daniel Wong', email: 'daniel@roadcrew.demo', password: 'admin123', role: 'client', subregionId: null, brandId: 'b-jasmine', phone: '012-207 2007', status: 'active', avatar: 'img/avatar-08.svg' },
      { id: 'u-c08', name: 'Aina Zulkifli', email: 'aina@roadcrew.demo', password: 'admin123', role: 'client', subregionId: null, brandId: 'b-jasmine', phone: '012-208 2008', status: 'active', avatar: 'img/avatar-02.svg' },
      { id: 'u-c09', name: 'Kelvin Chew', email: 'kelvin@roadcrew.demo', password: 'admin123', role: 'client', subregionId: null, brandId: 'b-pocky', phone: '012-209 2009', status: 'active', avatar: 'img/avatar-03.svg' },
      { id: 'u-c10', name: 'Michelle Foo', email: 'michelle@roadcrew.demo', password: 'admin123', role: 'client', subregionId: null, brandId: 'b-pocky', phone: '012-210 2010', status: 'active', avatar: 'img/avatar-04.svg' },
      { id: 'u-c11', name: 'Hafiz Rahman', email: 'hafiz@roadcrew.demo', password: 'admin123', role: 'client', subregionId: null, brandId: 'b-kewpie', phone: '012-211 2011', status: 'active', avatar: 'img/avatar-05.svg' },

      { id: 'u-01', name: 'Airene', email: 'staff1@gmail.com', password: 'admin123', role: 'staff', subregionId: 'sr-east', brandId: null, phone: '013-101 1001', status: 'active', avatar: 'img/avatar-02.svg' },
      { id: 'u-02', name: 'Chrisnie', email: 'chrisnie@roadcrew.demo', password: 'admin123', role: 'staff', subregionId: 'sr-south', brandId: null, phone: '013-102 1002', status: 'active', avatar: 'img/avatar-03.svg' },
      { id: 'u-03', name: 'Elizabeth', email: 'elizabeth@roadcrew.demo', password: 'admin123', role: 'staff', subregionId: 'sr-central', brandId: null, phone: '013-103 1003', status: 'active', avatar: 'img/avatar-04.svg' },
      { id: 'u-04', name: 'Johnny', email: 'staff2@gmail.com', password: 'admin123', role: 'staff', subregionId: 'sr-central', brandId: null, phone: '013-104 1004', status: 'active', avatar: 'img/avatar-05.svg' },
      { id: 'u-05', name: 'Rou Qian', email: 'rouqian@roadcrew.demo', password: 'admin123', role: 'staff', subregionId: 'sr-east', brandId: null, phone: '013-105 1005', status: 'active', avatar: 'img/avatar-06.svg' },
      { id: 'u-06', name: 'Ying Zhi', email: 'yingzhi@roadcrew.demo', password: 'admin123', role: 'staff', subregionId: 'sr-east', brandId: null, phone: '013-106 1006', status: 'active', avatar: 'img/avatar-07.svg' },
      { id: 'u-07', name: 'Yong Lok', email: 'yonglok@roadcrew.demo', password: 'admin123', role: 'staff', subregionId: 'sr-central', brandId: null, phone: '013-107 1007', status: 'inactive', avatar: 'img/avatar-08.svg' }
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
      { id: 's-15', brandId: 'b-jasmine', outletId: 'o-14', spIds: [], startDate: '2026-09-19', endDate: '2026-09-20', shift: '10:00 – 18:00', status: 'planned', notes: 'Unassigned sample, needs a promoter' },
      { id: 's-16', brandId: 'b-pocky', outletId: 'o-15', spIds: ['u-03'], startDate: '2026-08-20', endDate: '2026-08-23', shift: '10:00 – 20:00', status: 'planned', notes: 'Pocky sampling, aisle-end stand' },
      { id: 's-17', brandId: 'b-kewpie', outletId: 'o-13', spIds: ['u-04'], startDate: '2026-09-01', endDate: '2026-09-03', shift: '10:00 – 18:00', status: 'planned', notes: 'Kewpie dressing tasting, fresh produce section' }
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
    // SKU names checked against each brand's own published range rather than invented.
    // Kapal Api is Indonesian coffee (Special Mix, Grande White Coffee, Cappuccino 3 in 1,
    // Kopi-O). Jasmine is Jasmine Food Corporation Malaysia, whose basmathi line is
    // Royal PusaGold and PusaCream and whose local white rice includes Super Special.
    // Pocky is Ezaki Glico, using flavours listed for the Malaysian market. Kewpie is
    // Kewpie Malaysia, whose Roasted Sesame Dressing is their headline dressing.
    products: [
      { id: 'p-ka-01', brandId: 'b-kapalapi', name: 'Special Mix' },
      { id: 'p-ka-02', brandId: 'b-kapalapi', name: 'Grande White Coffee' },
      { id: 'p-ka-03', brandId: 'b-kapalapi', name: 'Cappuccino 3 in 1' },
      { id: 'p-ka-04', brandId: 'b-kapalapi', name: 'Kopi-O' },
      { id: 'p-js-01', brandId: 'b-jasmine', name: 'PusaCream Basmathi 5kg' },
      { id: 'p-js-02', brandId: 'b-jasmine', name: 'Fragrant Rice 5kg' },
      { id: 'p-js-03', brandId: 'b-jasmine', name: 'Royal PusaGold 5kg' },
      { id: 'p-js-04', brandId: 'b-jasmine', name: 'Super Special 5kg' },
      { id: 'p-pk-01', brandId: 'b-pocky', name: 'Pocky Chocolate' },
      { id: 'p-pk-02', brandId: 'b-pocky', name: 'Pocky Strawberry' },
      { id: 'p-pk-03', brandId: 'b-pocky', name: 'Pocky Cookies & Cream' },
      { id: 'p-pk-04', brandId: 'b-pocky', name: 'Pocky Milky Matcha' },
      { id: 'p-kw-01', brandId: 'b-kewpie', name: 'Roasted Sesame Dressing' },
      { id: 'p-kw-02', brandId: 'b-kewpie', name: 'Mayonnaise Japanese Style' },
      { id: 'p-kw-03', brandId: 'b-kewpie', name: 'Half Salad Dressing' },
      { id: 'p-kw-04', brandId: 'b-kewpie', name: 'Sesame Soy Sauce Dressing' }
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
      { id: 'sa-40', scheduleId: 's-09', productId: 'p-js-04', date: '2026-08-31', units: 12 },
      // Pocky: s-16 Lotus's Setia Alam, 20-23 Aug. Chocolate leads, matcha trails.
      { id: 'sa-41', scheduleId: 's-16', productId: 'p-pk-01', date: '2026-08-20', units: 58 },
      { id: 'sa-42', scheduleId: 's-16', productId: 'p-pk-02', date: '2026-08-20', units: 44 },
      { id: 'sa-43', scheduleId: 's-16', productId: 'p-pk-03', date: '2026-08-20', units: 31 },
      { id: 'sa-44', scheduleId: 's-16', productId: 'p-pk-04', date: '2026-08-20', units: 19 },
      { id: 'sa-45', scheduleId: 's-16', productId: 'p-pk-01', date: '2026-08-21', units: 72 },
      { id: 'sa-46', scheduleId: 's-16', productId: 'p-pk-02', date: '2026-08-21', units: 55 },
      { id: 'sa-47', scheduleId: 's-16', productId: 'p-pk-03', date: '2026-08-21', units: 38 },
      { id: 'sa-48', scheduleId: 's-16', productId: 'p-pk-04', date: '2026-08-21', units: 24 },
      { id: 'sa-49', scheduleId: 's-16', productId: 'p-pk-01', date: '2026-08-22', units: 95 },
      { id: 'sa-50', scheduleId: 's-16', productId: 'p-pk-02', date: '2026-08-22', units: 71 },
      { id: 'sa-51', scheduleId: 's-16', productId: 'p-pk-03', date: '2026-08-22', units: 49 },
      { id: 'sa-52', scheduleId: 's-16', productId: 'p-pk-04', date: '2026-08-22', units: 31 },
      { id: 'sa-53', scheduleId: 's-16', productId: 'p-pk-01', date: '2026-08-23', units: 88 },
      { id: 'sa-54', scheduleId: 's-16', productId: 'p-pk-02', date: '2026-08-23', units: 66 },
      { id: 'sa-55', scheduleId: 's-16', productId: 'p-pk-03', date: '2026-08-23', units: 45 },
      { id: 'sa-56', scheduleId: 's-16', productId: 'p-pk-04', date: '2026-08-23', units: 28 },
      // Kewpie: s-17 Hero Subang, 1-3 Sep. Roasted Sesame leads, which matches its
      // real standing as the brand's headline dressing in Peninsular Malaysia.
      { id: 'sa-57', scheduleId: 's-17', productId: 'p-kw-01', date: '2026-09-01', units: 47 },
      { id: 'sa-58', scheduleId: 's-17', productId: 'p-kw-02', date: '2026-09-01', units: 39 },
      { id: 'sa-59', scheduleId: 's-17', productId: 'p-kw-03', date: '2026-09-01', units: 22 },
      { id: 'sa-60', scheduleId: 's-17', productId: 'p-kw-04', date: '2026-09-01', units: 16 },
      { id: 'sa-61', scheduleId: 's-17', productId: 'p-kw-01', date: '2026-09-02', units: 53 },
      { id: 'sa-62', scheduleId: 's-17', productId: 'p-kw-02', date: '2026-09-02', units: 44 },
      { id: 'sa-63', scheduleId: 's-17', productId: 'p-kw-03', date: '2026-09-02', units: 26 },
      { id: 'sa-64', scheduleId: 's-17', productId: 'p-kw-04', date: '2026-09-02', units: 18 },
      { id: 'sa-65', scheduleId: 's-17', productId: 'p-kw-01', date: '2026-09-03', units: 61 },
      { id: 'sa-66', scheduleId: 's-17', productId: 'p-kw-02', date: '2026-09-03', units: 48 },
      { id: 'sa-67', scheduleId: 's-17', productId: 'p-kw-03', date: '2026-09-03', units: 29 },
      { id: 'sa-68', scheduleId: 's-17', productId: 'p-kw-04', date: '2026-09-03', units: 21 }
    ],
    // Ids of seeded records the user has deleted through the UI. migrate() consults this
    // before re-adding anything, so a deletion sticks across a reload. Without it the
    // seed quietly resurrects every deleted region, sub-region, outlet or brand on the
    // next page load - which is exactly the screen the Regions panel is.
    deletedIds: [],

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
      Object.prototype.toString.call(state.subregions) === '[object Array]' &&
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

  // Bring a previously saved database up to date with the current seed.
  //
  // A browser that saved its state before `products` and `sales` existed keeps
  // returning a state without them, so the campaign reports rendered "No results
  // yet" forever even though the seed carries the data. The same applies to a
  // field added to an existing record - brands gained `reportPassword`, and a
  // stale brand record without it could never be unlocked.
  //
  // Only ever ADDS what is missing. A value the user has changed is never
  // overwritten, and a record they created is never touched.
  function migrate(state) {
    var changed = false;
    var key, i, j;

    // Read the tombstones before the key loop, because the loop is what would add the
    // deletedIds array to a state that predates it - and by then it is too late to
    // consult. Missing or malformed reads as "nothing deleted", which is the safe way
    // round: worst case a record comes back, never a record silently vanishes.
    var tombstoned = {};
    if (Object.prototype.toString.call(state.deletedIds) === '[object Array]') {
      for (i = 0; i < state.deletedIds.length; i++) {
        tombstoned[state.deletedIds[i]] = true;
      }
    }

    for (key in SEED) {
      if (!Object.prototype.hasOwnProperty.call(SEED, key)) { continue; }

      // Whole collection (or settings object) the seed has gained since.
      if (!Object.prototype.hasOwnProperty.call(state, key)) {
        state[key] = deepCopy(SEED[key]);
        changed = true;
        continue;
      }

      if (Object.prototype.toString.call(SEED[key]) !== '[object Array]') { continue; }

      for (i = 0; i < SEED[key].length; i++) {
        var seeded = SEED[key][i];
        var found = null;
        for (j = 0; j < state[key].length; j++) {
          if (state[key][j].id === seeded.id) { found = state[key][j]; break; }
        }

        // A record the seed has gained since - a new brand, its products, its sales.
        // Without this, adding demo data would only ever reach a browser that had
        // never opened the site. A seeded record the user DELETED is not re-added:
        // its id is tombstoned in state.deletedIds and skipped here. Records the user
        // created are never touched, and no existing field is ever overwritten.
        if (!found) {
          if (tombstoned[seeded.id]) { continue; }
          state[key].push(deepCopy(seeded));
          changed = true;
          continue;
        }

        // Fields added to a seeded record that the stored copy predates.
        var field;
        for (field in seeded) {
          if (!Object.prototype.hasOwnProperty.call(seeded, field)) { continue; }
          if (!Object.prototype.hasOwnProperty.call(found, field)) {
            found[field] = seeded[field];
            changed = true;
          }
        }
      }
    }

    return changed;
  }

  // The v1 payload under the old key can never be read again, so it is only holding
  // quota. Cleared once per page, the first time the database is touched.
  var legacyPurged = false;

  function purgeLegacy() {
    if (legacyPurged) { return; }
    legacyPurged = true;
    var i;
    for (i = 0; i < LEGACY_DB_KEYS.length; i += 1) {
      removeRaw(LEGACY_DB_KEYS[i]);
    }
  }

  function load() {
    purgeLegacy();
    var raw = readRaw();
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (isValidState(parsed)) {
          if (migrate(parsed)) {
            memoryState = parsed;
            return save(parsed);
          }
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

  // Dropping the key takes the tombstone list with it, so a reset genuinely restores
  // every seeded record - including the ones that were deleted on purpose.
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

  // True when the id belongs to a record the SEED ships. Only those can be resurrected
  // by migrate(), so only those are worth tombstoning - a record the user created and
  // then deleted is simply gone and needs no bookkeeping.
  function isSeeded(collectionName, id) {
    var seededList = SEED[collectionName];
    if (Object.prototype.toString.call(seededList) !== '[object Array]') { return false; }
    var i;
    for (i = 0; i < seededList.length; i += 1) {
      if (seededList[i] && seededList[i].id === id) { return true; }
    }
    return false;
  }

  function tombstoneList(state) {
    if (Object.prototype.toString.call(state.deletedIds) !== '[object Array]') {
      state.deletedIds = [];
    }
    return state.deletedIds;
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
    // Writing an id back lifts its tombstone, so the list never claims a record is
    // deleted while it is sitting in the collection.
    var graves = tombstoneList(state);
    var g;
    for (g = graves.length - 1; g >= 0; g -= 1) {
      if (record && graves[g] === record.id) { graves.splice(g, 1); }
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
      // Only a seeded id needs a tombstone, and only once.
      if (isSeeded(collectionName, id)) {
        var graves = tombstoneList(state);
        if (graves.indexOf(id) === -1) {
          graves.push(id);
        }
      }
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
    subregions: function () { return collection('subregions'); },
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
