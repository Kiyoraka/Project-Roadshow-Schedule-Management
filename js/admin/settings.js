/* RoadCrew - js/admin/settings.js
   Brief section 5.5: company profile, brands, check-in rules, demo reset.
   Load order: data.js, util.js, auth.js, settings.js
   -------------------------------------------------------------------------- */

window.RoadCrew = window.RoadCrew || {};

(function (R) {
  'use strict';

  var me = R.auth.requireRole('admin');
  if (!me) {
    return;
  }

  var U = R.util;

  var editingBrandId = '';   // '' while the inline form is in "add" mode
  // { kind: 'brand'|'region'|'subregion'|'outlet'|'reset', id: '' } queued for confirm.
  // One modal serves them all, discriminated here rather than by five copies of it.
  var pending = null;

  function byId(id) { return document.getElementById(id); }

  // Settings is a single object, so every save reads the whole state,
  // mutates state.settings and writes the state back.
  function patchSettings(mutate) {
    var state = R.db.load();
    if (!state.settings) { state.settings = {}; }
    mutate(state.settings);
    R.db.save(state);
    return state.settings;
  }

  /* ------------------------------------------------------------- company -- */

  function loadCompany() {
    var s = R.db.settings() || {};
    byId('s-company').value = s.companyName || '';
    byId('s-email').value = s.contactEmail || '';
    byId('s-phone').value = s.contactPhone || '';
  }

  function saveCompany() {
    var name = String(byId('s-company').value || '').replace(/^\s+|\s+$/g, '');
    if (!name) {
      U.toast('Company name cannot be empty.', 'danger');
      return;
    }
    var email = String(byId('s-email').value || '').replace(/^\s+|\s+$/g, '');
    var phone = String(byId('s-phone').value || '').replace(/^\s+|\s+$/g, '');

    patchSettings(function (settings) {
      settings.companyName = name;
      settings.contactEmail = email;
      settings.contactPhone = phone;
    });

    loadCompany();
    U.toast('Company profile saved.', 'success');
  }

  /* -------------------------------------------------------------- brands -- */

  function usageOf(brandId) {
    var all = R.db.schedules();
    var n = 0;
    var i;
    for (i = 0; i < all.length; i++) {
      if (all[i] && all[i].brandId === brandId) { n += 1; }
    }
    return n;
  }

  function usageLabel(n) {
    return n + (n === 1 ? ' schedule' : ' schedules');
  }

  // A brand left without a report password could never have its report opened,
  // so an empty field falls back to a slug of the name plus the year.
  function defaultReportPassword(name) {
    var slug = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return (slug || 'report') + '2026';
  }

  function renderBrands() {
    var brands = R.db.brands();
    var html = '';
    var i;

    for (i = 0; i < brands.length; i++) {
      var b = brands[i];
      var used = usageOf(b.id);

      html +=
        '<tr>' +
          '<td>' +
            '<span class="row row-gap">' +
              '<span class="dot" style="background:' + U.escapeHtml(b.color) + '"></span>' +
              '<span>' + U.escapeHtml(b.name) + '</span>' +
            '</span>' +
          '</td>' +
          '<td class="muted">' + (U.escapeHtml(b.reportPassword || '') || '&mdash;') + '</td>' +
          '<td class="muted">' + U.escapeHtml(usageLabel(used)) + '</td>' +
          '<td>' +
            '<span class="sched-actions">' +
              '<button class="sched-act" type="button" data-brand-edit="' + U.escapeHtml(b.id) + '" title="Edit">&#9998;</button>' +
              '<button class="sched-act" type="button" data-brand-delete="' + U.escapeHtml(b.id) + '" title="Delete">&#10005;</button>' +
            '</span>' +
          '</td>' +
        '</tr>';
    }

    byId('brand-rows').innerHTML = html ||
      '<tr><td colspan="4"><div class="empty"><div class="empty-text">' +
      'No brands yet. Add one below.</div></div></td></tr>';
  }

  function resetBrandForm() {
    editingBrandId = '';
    byId('b-name').value = '';
    byId('b-color').value = '#C0392B';
    byId('b-report-password').value = '';
    byId('b-add').textContent = 'Add brand';
    byId('b-cancel').hidden = true;
  }

  function editBrand(id) {
    var b = R.db.byId('brands', id);
    if (!b) { return; }
    editingBrandId = b.id;
    byId('b-name').value = b.name;
    byId('b-color').value = b.color || '#C0392B';
    byId('b-report-password').value = b.reportPassword || '';
    byId('b-add').textContent = 'Save brand';
    byId('b-cancel').hidden = false;
    byId('b-name').focus();
  }

  function submitBrand() {
    var name = String(byId('b-name').value || '').replace(/^\s+|\s+$/g, '');
    var color = String(byId('b-color').value || '#C0392B');
    var reportPassword =
      String(byId('b-report-password').value || '').replace(/^\s+|\s+$/g, '');

    if (!name) {
      U.toast('Give the brand a name first.', 'danger');
      return;
    }

    var brands = R.db.brands();
    var i;
    for (i = 0; i < brands.length; i++) {
      if (brands[i].id !== editingBrandId &&
          brands[i].name.toLowerCase() === name.toLowerCase()) {
        U.toast('A brand called ' + name + ' already exists.', 'danger');
        return;
      }
    }

    var editing = !!editingBrandId;

    if (!reportPassword) {
      reportPassword = defaultReportPassword(name);
    }

    // Persisting through R.db.upsert is all it takes: the schedule drawer
    // reads R.db.brands() every time it opens, so a new brand is selectable
    // there straight away.
    R.db.upsert('brands', {
      id: editingBrandId || U.uid('b'),
      name: name,
      color: color,
      reportPassword: reportPassword
    });

    resetBrandForm();
    renderBrands();
    U.toast(editing ? 'Brand updated.' : 'Brand added.', 'success');
  }

  // A brand still attached to a schedule is never deleted - the guard fires
  // before the confirm modal ever opens.
  function askDeleteBrand(id) {
    var b = R.db.byId('brands', id);
    if (!b) { return; }

    var used = usageOf(b.id);
    if (used > 0) {
      U.toast(b.name + ' is used by ' + usageLabel(used) + ' and cannot be deleted.', 'danger');
      return;
    }

    pending = { kind: 'brand', id: b.id };
    byId('confirm-title').textContent = 'Delete this brand?';
    byId('confirm-text').textContent =
      b.name + ' is not used by any schedule. Deleting it removes it from the ' +
      'brand picker for good.';
    byId('confirm-yes').textContent = 'Delete brand';
    byId('confirm').className = 'modal is-open';
  }

  /* ---------------------------------------------------------- check-ins -- */

  function loadCheckin() {
    var s = R.db.settings() || {};
    var c = s.checkin || {};
    byId('c-photo').checked = c.photoRequired !== false;
    byId('c-start').value = c.windowStart || '09:00';
    byId('c-end').value = c.windowEnd || '19:00';
    byId('c-max').value = c.maxPhotos || 3;
  }

  function saveCheckin() {
    var start = String(byId('c-start').value || '');
    var end = String(byId('c-end').value || '');
    var max = parseInt(byId('c-max').value, 10);

    if (!start || !end) {
      U.toast('Set both ends of the check-in window.', 'danger');
      return;
    }
    if (end <= start) {
      U.toast('The check-in window must close after it opens.', 'danger');
      return;
    }
    if (isNaN(max) || max < 1) {
      U.toast('Allow at least one photo per event.', 'danger');
      return;
    }

    var required = byId('c-photo').checked;

    patchSettings(function (settings) {
      settings.checkin = {
        photoRequired: required,
        windowStart: start,
        windowEnd: end,
        maxPhotos: max
      };
    });

    loadCheckin();
    U.toast('Check-in rules saved.', 'success');
  }

  /* ------------------------------------------------------------- regions -- */

  // Three levels in one panel. The two selections are what tie the tables
  // together: picking a region fills the sub-region table, picking a sub-region
  // fills the outlet table. Both are ids, never indexes, so a delete or a rename
  // anywhere else cannot silently move the selection to a different row.
  var selectedRegionId = '';
  var selectedSubregionId = '';
  var editingRegionId = '';
  var editingSubregionId = '';
  var editingOutletId = '';

  function countLabel(n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
  }

  function subregionsOf(regionId) {
    var all = R.db.subregions();
    var out = [];
    var i;
    for (i = 0; i < all.length; i++) {
      if (all[i] && all[i].regionId === regionId) { out.push(all[i]); }
    }
    return out;
  }

  function outletsOf(subregionId) {
    var all = R.db.outlets();
    var out = [];
    var i;
    for (i = 0; i < all.length; i++) {
      if (all[i] && all[i].subregionId === subregionId) { out.push(all[i]); }
    }
    return out;
  }

  // Promoters are pinned to a sub-region, so deleting one would leave them
  // pointing at nothing. Counted as a delete blocker alongside outlets.
  function peopleOf(subregionId) {
    var all = R.db.users();
    var n = 0;
    var i;
    for (i = 0; i < all.length; i++) {
      if (all[i] && all[i].subregionId === subregionId) { n += 1; }
    }
    return n;
  }

  function outletCountOfRegion(regionId) {
    var subs = subregionsOf(regionId);
    var n = 0;
    var i;
    for (i = 0; i < subs.length; i++) { n += outletsOf(subs[i].id).length; }
    return n;
  }

  function schedulesOfOutlet(outletId) {
    var all = R.db.schedules();
    var n = 0;
    var i;
    for (i = 0; i < all.length; i++) {
      if (all[i] && all[i].outletId === outletId) { n += 1; }
    }
    return n;
  }

  function actionsCell(editAttr, deleteAttr, id) {
    return '<td>' +
      '<span class="sched-actions">' +
        '<button class="sched-act" type="button" ' + editAttr + '="' + U.escapeHtml(id) + '" title="Edit">&#9998;</button>' +
        '<button class="sched-act" type="button" ' + deleteAttr + '="' + U.escapeHtml(id) + '" title="Delete">&#10005;</button>' +
      '</span>' +
    '</td>';
  }

  function emptyRow(cols, text) {
    return '<tr><td colspan="' + cols + '"><div class="empty"><div class="empty-text">' +
      U.escapeHtml(text) + '</div></div></td></tr>';
  }

  function renderRegions() {
    var regions = R.db.regions();
    var html = '';
    var i;

    // A selection pointing at a region that no longer exists would leave both
    // tables below stranded, so it falls back to the first row.
    if (selectedRegionId && !R.db.byId('regions', selectedRegionId)) { selectedRegionId = ''; }
    if (!selectedRegionId && regions.length) { selectedRegionId = regions[0].id; }

    for (i = 0; i < regions.length; i++) {
      var r = regions[i];
      var subs = subregionsOf(r.id).length;
      html +=
        '<tr class="' + (r.id === selectedRegionId ? 'is-picked' : '') + '" data-region-pick="' + U.escapeHtml(r.id) + '">' +
          '<td>' + U.escapeHtml(r.name) + '</td>' +
          '<td class="muted">' + (U.escapeHtml(r.code || '') || '&mdash;') + '</td>' +
          '<td class="muted">' + U.escapeHtml(String(subs)) + '</td>' +
          '<td class="muted">' + U.escapeHtml(String(outletCountOfRegion(r.id))) + '</td>' +
          actionsCell('data-region-edit', 'data-region-delete', r.id) +
        '</tr>';
    }

    byId('region-rows').innerHTML = html || emptyRow(5, 'No regions yet. Add one below.');
  }

  function renderSubregions() {
    var region = selectedRegionId ? R.db.byId('regions', selectedRegionId) : null;
    var rows = region ? subregionsOf(region.id) : [];
    var html = '';
    var i;

    byId('subregion-title').textContent =
      region ? 'Sub-regions of ' + region.name : 'Sub-regions';

    if (selectedSubregionId) {
      var still = R.db.byId('subregions', selectedSubregionId);
      if (!still || still.regionId !== selectedRegionId) { selectedSubregionId = ''; }
    }
    if (!selectedSubregionId && rows.length) { selectedSubregionId = rows[0].id; }

    for (i = 0; i < rows.length; i++) {
      var sr = rows[i];
      html +=
        '<tr class="' + (sr.id === selectedSubregionId ? 'is-picked' : '') + '" data-subregion-pick="' + U.escapeHtml(sr.id) + '">' +
          '<td>' + U.escapeHtml(sr.name) + '</td>' +
          '<td class="muted">' + U.escapeHtml(String(outletsOf(sr.id).length)) + '</td>' +
          '<td class="muted">' + U.escapeHtml(String(peopleOf(sr.id))) + '</td>' +
          actionsCell('data-subregion-edit', 'data-subregion-delete', sr.id) +
        '</tr>';
    }

    byId('subregion-rows').innerHTML = html || emptyRow(4,
      region ? 'No sub-regions in ' + region.name + ' yet. Add one below.'
             : 'Pick a region first.');
  }

  function renderOutlets() {
    var sub = selectedSubregionId ? R.db.byId('subregions', selectedSubregionId) : null;
    var rows = sub ? outletsOf(sub.id) : [];
    var html = '';
    var i;

    byId('outlet-title').textContent = sub ? 'Outlets in ' + sub.name : 'Outlets';

    for (i = 0; i < rows.length; i++) {
      var o = rows[i];
      html +=
        '<tr>' +
          '<td>' + U.escapeHtml(o.name) + '</td>' +
          '<td class="muted">' + (U.escapeHtml(o.city || '') || '&mdash;') + '</td>' +
          '<td class="muted">' + U.escapeHtml(String(schedulesOfOutlet(o.id))) + '</td>' +
          actionsCell('data-outlet-edit', 'data-outlet-delete', o.id) +
        '</tr>';
    }

    byId('outlet-rows').innerHTML = html || emptyRow(4,
      sub ? 'No outlets in ' + sub.name + ' yet. Add one below.'
          : 'Pick a sub-region first.');
  }

  function renderRegionPanel() {
    renderRegions();
    renderSubregions();
    renderOutlets();
  }

  // Case-insensitive, excluding the row being edited - the same check the brand
  // form makes. Sub-region and outlet names only have to be unique within their
  // own parent, so two regions can each hold a "Central" without complaint.
  function nameTaken(rows, name, exceptId) {
    var i;
    for (i = 0; i < rows.length; i++) {
      if (rows[i].id !== exceptId && String(rows[i].name).toLowerCase() === name.toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  function trimmed(id) {
    return String(byId(id).value || '').replace(/^\s+|\s+$/g, '');
  }

  /* level 1 */

  function resetRegionForm() {
    editingRegionId = '';
    byId('rg-name').value = '';
    byId('rg-code').value = '';
    byId('rg-add').textContent = 'Add region';
    byId('rg-cancel').hidden = true;
  }

  function editRegion(id) {
    var r = R.db.byId('regions', id);
    if (!r) { return; }
    editingRegionId = r.id;
    byId('rg-name').value = r.name;
    byId('rg-code').value = r.code || '';
    byId('rg-add').textContent = 'Save region';
    byId('rg-cancel').hidden = false;
    byId('rg-name').focus();
  }

  function submitRegion() {
    var name = trimmed('rg-name');
    if (!name) {
      U.toast('Give the region a name first.', 'danger');
      return;
    }
    if (nameTaken(R.db.regions(), name, editingRegionId)) {
      U.toast('A region called ' + name + ' already exists.', 'danger');
      return;
    }

    var editing = !!editingRegionId;
    var id = editingRegionId || U.uid('reg');
    R.db.upsert('regions', { id: id, name: name, code: trimmed('rg-code').toUpperCase() });

    if (!editing) { selectedRegionId = id; selectedSubregionId = ''; }
    resetRegionForm();
    renderRegionPanel();
    U.toast(editing ? 'Region updated.' : 'Region added.', 'success');
  }

  function askDeleteRegion(id) {
    var r = R.db.byId('regions', id);
    if (!r) { return; }

    var subs = subregionsOf(id).length;
    if (subs > 0) {
      U.toast(r.name + ' still holds ' + countLabel(subs, 'sub-region', 'sub-regions') +
        ' and cannot be deleted.', 'danger');
      return;
    }

    pending = { kind: 'region', id: id };
    byId('confirm-title').textContent = 'Delete this region?';
    byId('confirm-text').textContent =
      r.name + ' holds no sub-regions. Deleting it removes it from every region ' +
      'picker for good.';
    byId('confirm-yes').textContent = 'Delete region';
    byId('confirm').className = 'modal is-open';
  }

  /* level 2 */

  function resetSubregionForm() {
    editingSubregionId = '';
    byId('sr-name').value = '';
    byId('sr-add').textContent = 'Add sub-region';
    byId('sr-cancel').hidden = true;
  }

  function editSubregion(id) {
    var sr = R.db.byId('subregions', id);
    if (!sr) { return; }
    editingSubregionId = sr.id;
    byId('sr-name').value = sr.name;
    byId('sr-add').textContent = 'Save sub-region';
    byId('sr-cancel').hidden = false;
    byId('sr-name').focus();
  }

  function submitSubregion() {
    if (!selectedRegionId) {
      U.toast('Pick a region first.', 'danger');
      return;
    }
    var name = trimmed('sr-name');
    if (!name) {
      U.toast('Give the sub-region a name first.', 'danger');
      return;
    }
    if (nameTaken(subregionsOf(selectedRegionId), name, editingSubregionId)) {
      U.toast('That region already has a sub-region called ' + name + '.', 'danger');
      return;
    }

    var editing = !!editingSubregionId;
    var id = editingSubregionId || U.uid('sr');
    R.db.upsert('subregions', { id: id, regionId: selectedRegionId, name: name });

    if (!editing) { selectedSubregionId = id; }
    resetSubregionForm();
    renderRegionPanel();
    U.toast(editing ? 'Sub-region updated.' : 'Sub-region added.', 'success');
  }

  function askDeleteSubregion(id) {
    var sr = R.db.byId('subregions', id);
    if (!sr) { return; }

    var outlets = outletsOf(id).length;
    var people = peopleOf(id);
    if (outlets > 0 || people > 0) {
      var held = [];
      if (outlets > 0) { held.push(countLabel(outlets, 'outlet', 'outlets')); }
      if (people > 0) { held.push(countLabel(people, 'person', 'people')); }
      U.toast(sr.name + ' still holds ' + held.join(' and ') + ' and cannot be deleted.', 'danger');
      return;
    }

    pending = { kind: 'subregion', id: id };
    byId('confirm-title').textContent = 'Delete this sub-region?';
    byId('confirm-text').textContent =
      sr.name + ' holds no outlets and nobody is assigned to it. Deleting it removes ' +
      'it from every filter for good.';
    byId('confirm-yes').textContent = 'Delete sub-region';
    byId('confirm').className = 'modal is-open';
  }

  /* level 3 */

  function resetOutletForm() {
    editingOutletId = '';
    byId('ol-name').value = '';
    byId('ol-city').value = '';
    byId('ol-add').textContent = 'Add outlet';
    byId('ol-cancel').hidden = true;
  }

  function editOutlet(id) {
    var o = R.db.byId('outlets', id);
    if (!o) { return; }
    editingOutletId = o.id;
    byId('ol-name').value = o.name;
    byId('ol-city').value = o.city || '';
    byId('ol-add').textContent = 'Save outlet';
    byId('ol-cancel').hidden = false;
    byId('ol-name').focus();
  }

  function submitOutlet() {
    if (!selectedSubregionId) {
      U.toast('Pick a sub-region first.', 'danger');
      return;
    }
    var name = trimmed('ol-name');
    if (!name) {
      U.toast('Give the outlet a name first.', 'danger');
      return;
    }
    if (nameTaken(outletsOf(selectedSubregionId), name, editingOutletId)) {
      U.toast('That sub-region already has an outlet called ' + name + '.', 'danger');
      return;
    }

    var editing = !!editingOutletId;
    R.db.upsert('outlets', {
      id: editingOutletId || U.uid('o'),
      subregionId: selectedSubregionId,
      name: name,
      city: trimmed('ol-city')
    });

    resetOutletForm();
    renderRegionPanel();
    U.toast(editing ? 'Outlet updated.' : 'Outlet added.', 'success');
  }

  function askDeleteOutlet(id) {
    var o = R.db.byId('outlets', id);
    if (!o) { return; }

    var used = schedulesOfOutlet(id);
    if (used > 0) {
      U.toast(o.name + ' is used by ' + countLabel(used, 'schedule', 'schedules') +
        ' and cannot be deleted.', 'danger');
      return;
    }

    pending = { kind: 'outlet', id: id };
    byId('confirm-title').textContent = 'Delete this outlet?';
    byId('confirm-text').textContent =
      o.name + ' is not used by any schedule. Deleting it removes it from the outlet ' +
      'picker for good.';
    byId('confirm-yes').textContent = 'Delete outlet';
    byId('confirm').className = 'modal is-open';
  }

  /* ---------------------------------------------------------- demo data -- */

  function askReset() {
    pending = { kind: 'reset', id: '' };
    byId('confirm-title').textContent = 'Reset demo data?';
    byId('confirm-text').textContent =
      'Every brand, schedule, user and uploaded photo stored in this browser is ' +
      'replaced with the original sample data. You will be signed out.';
    byId('confirm-yes').textContent = 'Reset demo data';
    byId('confirm').className = 'modal is-open';
  }

  function closeConfirm() {
    pending = null;
    byId('confirm').className = 'modal';
  }

  function runPending() {
    if (!pending) {
      closeConfirm();
      return;
    }

    if (pending.kind === 'reset') {
      R.db.reset();
      // reset() clears the session too, so a normal in-app link would only
      // bounce through the guard - go straight back to the landing page.
      window.location.href = '../index.html';
      return;
    }

    if (pending.kind === 'brand') {
      var id = pending.id;
      var b = R.db.byId('brands', id);
      var used = b ? usageOf(id) : 0;
      // Second read of the guard: the count is checked again at the moment
      // of deletion, not only when the modal opened.
      if (b && used === 0) {
        R.db.remove('brands', id);
        U.toast('Brand deleted.', 'info');
      } else if (b) {
        U.toast(b.name + ' is used by ' + usageLabel(used) + ' and cannot be deleted.', 'danger');
      }
      closeConfirm();
      if (editingBrandId === id) { resetBrandForm(); }
      renderBrands();
      return;
    }

    // Every region-level delete re-reads its own guard here, at the moment of
    // deletion, not only when the modal opened. The panel has three tables that
    // can all be edited between those two moments.
    if (pending.kind === 'region') {
      var rid = pending.id;
      var region = R.db.byId('regions', rid);
      var heldSubs = region ? subregionsOf(rid).length : 0;
      if (region && heldSubs === 0) {
        R.db.remove('regions', rid);
        if (selectedRegionId === rid) { selectedRegionId = ''; selectedSubregionId = ''; }
        U.toast('Region deleted.', 'info');
      } else if (region) {
        U.toast(region.name + ' still holds ' + countLabel(heldSubs, 'sub-region', 'sub-regions') +
          ' and cannot be deleted.', 'danger');
      }
      closeConfirm();
      if (editingRegionId === rid) { resetRegionForm(); }
      renderRegionPanel();
      return;
    }

    if (pending.kind === 'subregion') {
      var sid = pending.id;
      var sub = R.db.byId('subregions', sid);
      var heldOutlets = sub ? outletsOf(sid).length : 0;
      var heldPeople = sub ? peopleOf(sid) : 0;
      if (sub && heldOutlets === 0 && heldPeople === 0) {
        R.db.remove('subregions', sid);
        if (selectedSubregionId === sid) { selectedSubregionId = ''; }
        U.toast('Sub-region deleted.', 'info');
      } else if (sub) {
        U.toast(sub.name + ' is no longer empty and cannot be deleted.', 'danger');
      }
      closeConfirm();
      if (editingSubregionId === sid) { resetSubregionForm(); }
      renderRegionPanel();
      return;
    }

    if (pending.kind === 'outlet') {
      var oid = pending.id;
      var outlet = R.db.byId('outlets', oid);
      var heldSchedules = outlet ? schedulesOfOutlet(oid) : 0;
      if (outlet && heldSchedules === 0) {
        R.db.remove('outlets', oid);
        U.toast('Outlet deleted.', 'info');
      } else if (outlet) {
        U.toast(outlet.name + ' is used by ' + countLabel(heldSchedules, 'schedule', 'schedules') +
          ' and cannot be deleted.', 'danger');
      }
      closeConfirm();
      if (editingOutletId === oid) { resetOutletForm(); }
      renderRegionPanel();
      return;
    }

    closeConfirm();
  }

  /* --------------------------------------------------------------- chrome -- */

  function renderChrome() {
    var iso = U.todayISO();
    var d = U.fromISO(iso);
    byId('topbar-date').textContent =
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ', ' + U.fmtDate(iso);
    byId('topbar-initial').textContent = U.initials(me.name);
    byId('appbar-initial').textContent = U.initials(me.name);
    byId('side-initial').textContent = U.initials(me.name);
    byId('side-name').textContent = me.name;
  }

  function on(id, event, fn) {
    var el = byId(id);
    if (el) { el.addEventListener(event, fn); }
  }

  // Walks up from the click target looking for an action attribute first, then the
  // row's pick attribute. The order is load-bearing: the Edit and Delete buttons sit
  // inside the row that carries the pick attribute, so testing the actions first is
  // what stops an Edit click from also moving the selection out from under the form.
  function regionRowHandler(tbodyId, spec) {
    var tbody = byId(tbodyId);
    if (!tbody) { return; }
    tbody.addEventListener('click', function (ev) {
      var node = ev.target;
      while (node && node !== this) {
        if (node.getAttribute) {
          if (spec.edit && node.getAttribute(spec.edit)) {
            spec.onEdit(node.getAttribute(spec.edit));
            return;
          }
          if (spec.del && node.getAttribute(spec.del)) {
            spec.onDelete(node.getAttribute(spec.del));
            return;
          }
          if (spec.pick && node.getAttribute(spec.pick)) {
            spec.onPick(node.getAttribute(spec.pick));
            return;
          }
        }
        node = node.parentNode;
      }
    });
  }

  /* ----------------------------------------------------------------- tabs -- */

  // Five panels that would otherwise stack into a very long scroll. Each one is
  // self-contained - its own fields, its own load and save - so switching is purely
  // a visibility change and none of those functions know this exists. Regions sits
  // next to Brands because both are master data; Demo data stays last because it is
  // the destructive one.
  var TABS = ['company', 'brands', 'regions', 'checkin', 'demo'];

  function showTab(name) {
    var want = TABS.indexOf(name) === -1 ? TABS[0] : name;
    var i;

    for (i = 0; i < TABS.length; i++) {
      var panel = byId('tab-' + TABS[i]);
      if (panel) { panel.hidden = TABS[i] !== want; }
    }

    var btns = document.querySelectorAll('[data-tab]');
    for (i = 0; i < btns.length; i++) {
      btns[i].className = 'viewseg-btn' +
        (btns[i].getAttribute('data-tab') === want ? ' is-active' : '');
    }

    // The hash is what survives a save or a reload. Written without pushing a
    // history entry, so Back leaves the page rather than walking the tabs.
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '#' + want);
    } else {
      window.location.hash = want;
    }
  }

  // An unknown or missing hash falls back to the first tab rather than showing
  // a page with every panel hidden.
  function tabFromHash() {
    var raw = String(window.location.hash || '').replace('#', '');
    return TABS.indexOf(raw) === -1 ? TABS[0] : raw;
  }

  function wire() {
    var i;

    var tabs = document.querySelectorAll('[data-tab]');
    for (i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function (ev) {
        showTab(ev.currentTarget.getAttribute('data-tab'));
      });
    }

    // Arriving at #brands while already on this page is a hash change, not a
    // load, so init never runs again. Without this a link to a specific tab
    // works from anywhere except the page it points at.
    window.addEventListener('hashchange', function () {
      showTab(tabFromHash());
    });

    var outs = document.querySelectorAll('[data-logout]');
    for (i = 0; i < outs.length; i++) {
      outs[i].addEventListener('click', function () { R.auth.logout(); });
    }

    on('s-save', 'click', saveCompany);
    on('c-save', 'click', saveCheckin);
    on('b-add', 'click', submitBrand);
    on('b-cancel', 'click', resetBrandForm);
    on('rg-add', 'click', submitRegion);
    on('rg-cancel', 'click', resetRegionForm);
    on('sr-add', 'click', submitSubregion);
    on('sr-cancel', 'click', resetSubregionForm);
    on('ol-add', 'click', submitOutlet);
    on('ol-cancel', 'click', resetOutletForm);
    on('demo-reset', 'click', askReset);

    // One delegated handler per tbody, matching the Brands pattern - scoped to the
    // table rather than the document, so a re-render never leaves a stale listener.
    // The pick attribute sits on the row and the buttons sit inside it, so the walk
    // finds the button first and a click on Edit never also changes the selection.
    regionRowHandler('region-rows', {
      pick: 'data-region-pick', edit: 'data-region-edit', del: 'data-region-delete',
      onPick: function (id) {
        if (selectedRegionId === id) { return; }
        selectedRegionId = id;
        selectedSubregionId = '';
        resetSubregionForm();
        resetOutletForm();
        renderRegionPanel();
      },
      onEdit: editRegion,
      onDelete: askDeleteRegion
    });

    regionRowHandler('subregion-rows', {
      pick: 'data-subregion-pick', edit: 'data-subregion-edit', del: 'data-subregion-delete',
      onPick: function (id) {
        if (selectedSubregionId === id) { return; }
        selectedSubregionId = id;
        resetOutletForm();
        renderRegionPanel();
      },
      onEdit: editSubregion,
      onDelete: askDeleteSubregion
    });

    regionRowHandler('outlet-rows', {
      edit: 'data-outlet-edit', del: 'data-outlet-delete',
      onEdit: editOutlet,
      onDelete: askDeleteOutlet
    });

    byId('brand-rows').addEventListener('click', function (ev) {
      var node = ev.target;
      while (node && node !== this) {
        if (node.getAttribute) {
          if (node.getAttribute('data-brand-edit')) {
            editBrand(node.getAttribute('data-brand-edit'));
            return;
          }
          if (node.getAttribute('data-brand-delete')) {
            askDeleteBrand(node.getAttribute('data-brand-delete'));
            return;
          }
        }
        node = node.parentNode;
      }
    });

    on('confirm-no', 'click', closeConfirm);
    on('confirm-yes', 'click', runPending);
  }

  function init() {
    R.auth.consumeWrongPortalFlag();

    renderChrome();
    loadCompany();
    loadCheckin();
    resetBrandForm();
    renderBrands();
    resetRegionForm();
    resetSubregionForm();
    resetOutletForm();
    renderRegionPanel();
    wire();
    // Every panel is loaded regardless of which tab is showing, so switching
    // never waits on anything and a save on a hidden panel is impossible.
    showTab(tabFromHash());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.RoadCrew);
