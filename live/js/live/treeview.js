// ---------------------------------------------
// --- Name:    Easy DHTML Treeview           --
// --- Author:  D.D. de Kerf                  --
// --- Adapted: Markus Ehrnsperger            --
// --- Adapted: Jasmin Jessich                --
// --- Adapted: hepi (via patch)              --
// --- Adapted: Dieter Hametner               --
// --- Version: 0.3          Date: 14-6-2017  --
// ---------------------------------------------

/* ---------------------------------------------
** NOTE: The parameter 'descend' indicates that
** selection shall (or can) apply to the folder
** hierarchy. This means that both (de-)select
** all recurses into sub-folders and that the
** counts of selected recordings are updated
** up the hierarchy.
** ------------------------------------------ */

async function populate_folder(fldr_hash, descend = false, recursive = false) {
  const folder = fldr_ids[fldr_hash];
  var dom_changed = false;
// down the hierarchy
  const sub_fldr_ids = recursive ? folder?.fldr_ids : [];
  for (const sub_fldr_hash of sub_fldr_ids) {
    dom_changed |= await populate_folder(sub_fldr_hash, descend, recursive);
  }
// the current folder
  const rec_id = rec_ids[fldr_hash];
  if (rec_id && rec_id.display_folder != 2) {
    rec_id.display_folder = 2;
    const to_insert = await rec_string_d_a(rec_id, descend);
    const rec_list = document.getElementById(fldr_hash);
    rec_list.insertAdjacentHTML("beforeend", to_insert);
    dom_changed = true;
  }
  return dom_changed;
}

function update_icon(icon, src, label, classActive = '', setActive = false) {
// input: images nodes
// -> assign icon overlay, tooltip and class for indicating actives state
  if (icon) {
    if (src) icon.src = src;
    if (label) icon.$tmp.myText = label;
    if (classActive) icon.classList.toggle(classActive, setActive);
  }
}

function set_folder_closed(fldr_hash, descend = false) {
  const rec_item = document.getElementById(fldr_hash);
  if (rec_item) {
    updateCookieOnCollapse(fldr_hash);
    set_icons_closed(fldr_hash);
    rec_item.style.display = 'none';
  }
}
async function set_folder_open(fldr_hash, descend = false) {
// return true in case of a dom change
  const rec_item = document.getElementById(fldr_hash);
  if (rec_item) {
    updateCookieOnExpand(fldr_hash);
    var dom_changed = await populate_folder(fldr_hash, descend, false);
    set_icons_open(fldr_hash);
    rec_item.style.display = 'revert-layer';
  }
  return dom_changed;
}

function SetCheckboxValues(fldr_hash, value = false) {
  let processed = 0;
  if (rec_ids[fldr_hash]) {
    for (const recid of rec_ids[fldr_hash]?.items) {
      const cb = document.getElementById("cb_" + fldr_hash + '_' + recid);
      if (cb && cb.checked != value) {
        cb.checked = value;
        processed++;
      }
    }
  }
  return processed;
}

// in global scope to avoid re-evaluation per function call
const regExCheckedStatus = new RegExp('(<span>)[^<]*(</span>)');

function updateSelectionIcon(folder, icon, descend = false)
{
  if (folder && icon) {
    total = descend ? folder.total : folder.local;
    let active = icon.id.startsWith('ca_') ? folder.checked >= total : folder.checked > 0;
    icon.classList.toggle('active', active);
    if (icon.$tmp) {
      var status;
      if (folder.checked == 0)
        status = gettext_Checked_none();
      else if (folder.checked < total)
        status = folder.checked + ' / ' + total;
      else
        status = gettext_Checked_all();
      var hint = icon.$tmp.myText ?? '';
      icon.$tmp.myText = hint.replace(regExCheckedStatus, '$1' + status + '$2');
    }
  }
}
function updateFolderSelectionIcons(folder, descend = false)
{
  for (const tag of ['ca_', 'ua_']) {
    updateSelectionIcon(folder, document.getElementById(tag + folder?.id), descend);
  }
}
function updateFolderItems(folder, descend = false)
{
  let items = document.getElementById('nr_' + folder.id);
  if (folder && items) {
    if (!descend || folder.checked == 0)
      items.innerText = folder.total;
    else {
      items.innerText = folder.checked + ' / ' + folder.total;
    }
  }
}
function updateParentFolders(fldr_hash, delta, descend = false)
{
  let parent_hash = descend ? fldr_ids[fldr_hash]?.parent_id : null;
  while (parent_hash) {
    parent = fldr_ids[parent_hash];
    if (parent) {
      parent.checked = Math.max(Math.min(parent.checked + delta, parent.total), 0);
      updateFolderSelectionIcons(parent, descend);
      updateFolderItems(parent, descend);
    }
    parent_hash = parent?.parent_id;
  }
}

function checkAllRecordings(fldr_hash, descend = false)
{
  const folder = fldr_ids[fldr_hash];
  let processed = SetCheckboxValues(fldr_hash, true);
  if (folder) {
    for (const sub_fldr_hash of descend ? folder.fldr_ids : []) {
      processed += checkAllRecordings(sub_fldr_hash, descend);
    }
    folder.checked += processed;
    updateFolderSelectionIcons(folder, descend);
    updateFolderItems(folder, descend);
  }
  return processed;
}
async function CheckAll(node, fldr_hash, descend = false)
{
  const rec_list = document.getElementById(fldr_hash);
  if (descend || (rec_list?.style.display ?? "none") != "none") {
    await populate_folder(fldr_hash, descend, true);
    let delta = checkAllRecordings(fldr_hash, descend);
    updateParentFolders(fldr_hash, delta, descend);
  }
}

function uncheckAllRecordings(fldr_hash, descend)
{
  const folder = fldr_ids[fldr_hash];
  let processed = SetCheckboxValues(fldr_hash, false);
  if (folder) {
    for (const sub_fldr_hash of descend ? folder.fldr_ids : []) {
      processed += uncheckAllRecordings(sub_fldr_hash, descend);
    }
    folder.checked = Math.max(folder.checked - processed, 0);
    updateFolderSelectionIcons(folder, descend);
    updateFolderItems(folder, descend);
  }
  return processed;
}
async function UncheckAll(node, fldr_hash, descend = false)
{
  let delta = -uncheckAllRecordings(fldr_hash, descend);
  updateParentFolders(fldr_hash, delta, descend);
}

async function ToggleChecked(node, fldr_hash, descend = false) {
  const folder = fldr_ids[fldr_hash];
  if (node && folder) {
    let delta = node.checked ? 1 : -1;
    folder.checked += delta;
    updateFolderSelectionIcons(folder, descend);
    updateFolderItems(folder, descend);
    updateParentFolders(fldr_hash, delta, descend);
  }
}

async function Toggle(node, fldr_hash, descend = false)
{
  const rec_item = document.getElementById(fldr_hash);
  if (rec_item) {
// Unfold the branch if it isn't visible
    if (rec_item.style.display == 'none') {
      if (await set_folder_open(fldr_hash, descend) ) {
        if (typeof liveEnhanced !== 'undefined') liveEnhanced.domReadySetup();
        imgLoad();
      }
    } else {
// Collapse the branch if it IS visible
      if (!descend) {
        UncheckAll(node, fldr_hash, true);
      }
      set_folder_closed(fldr_hash, descend);
    }
  }
}

function setRecordingCounts(fldr_hash, descend = false)
{
  let recordings = rec_ids[fldr_hash]?.items?.length ?? 0;
  const folder = fldr_ids[fldr_hash];
  if (folder) {
    folder.local = recordings;
    for (const sub_fldr_hash of descend ? folder.fldr_ids : []) {
      recordings += setRecordingCounts(sub_fldr_hash, descend);
    }
    folder.total = recordings;
  }
  const count = document.getElementById('nr_' + fldr_hash);
  if (count) {
    count.innerText = recordings;
  }
  return recordings;
}

function saveSelection(form)
{
  let checkboxes = {};
  for (const input of form?.getElementsByTagName('input') ?? []) {
    if (input.type == 'checkbox' && input.checked) {
      const parts = input.id.split('_');
      if (parts.length >= 3) {
        const fldr_hash = parts[1];
        const recid = parts[2];
        if (fldr_hash in checkboxes)
          checkboxes[fldr_hash] += '+' + recid;
        else
          checkboxes[fldr_hash] = fldr_hash + ':' + recid;
      }
    }
  }
  if (Object.keys(checkboxes).length > 0) {
    createCookie(cookieNameSelection, Object.values(checkboxes).join(','), 1);
  } else {
    clearSavedSelection();
  }
}

async function restoreSelection(descend = false)
{
  var dom_changed = false;
  clearCheckboxes(document.getElementById('form_recordings'));
  const cookie = readCookie(cookieNameSelection);
  for (const data of cookie?.split(',') ?? []) {
    const parts = data.split(':');
    if (parts.length >= 2) {
      const fldr_hash = parts[0];
      const folder = fldr_ids[fldr_hash];
      if (folder.parent_id) {
        // we only need to populate the folder in which the checkboxes reside, but no subfolder
        dom_changed |= await populate_folder(fldr_hash, descend, false);
      }
      for (const recid of parts[1]?.split('+') ?? []) {
        const id = 'cb_' + fldr_hash + '_' + recid;
        const input = document.getElementById(id);
        if (input?.type == 'checkbox') {
          input.checked = true;
          folder.checked++;
        }
      }
      if (folder.parent_id) {
        updateFolderSelectionIcons(folder, descend);
        updateFolderItems(folder, descend);
        updateParentFolders(fldr_hash, folder.checked, descend);
      }
    }
  }
  return dom_changed;
}

function clearSavedSelection()
{
  eraseCookie(cookieNameSelection);
}

function saveSelection(form)
{
  let checkboxes = [];
  for (const input of form?.getElementsByTagName('input') ?? []) {
    if (input.type == 'checkbox' && input.checked) {
      checkboxes.push(input.id);
    }
  }
  if (checkboxes.length > 0) {
    createCookie(cookieNameSelection, checkboxes.join(','), 1);
  } else {
    clearSavedSelection();
  }
}

function restoreSelection()
{
  clearCheckboxes(document.getElementById('form_recordings'));
  const cookie = readCookie(cookieNameSelection);
  for (const id of cookie?.split(',') ?? []) {
    const fldr_hash = id.split('_')[1];
    const input = document.getElementById(id);
    if (input?.type == 'checkbox') {
      input.checked = true;
    }
  }
}

function clearSavedSelection()
{
  eraseCookie(cookieNameSelection);
}

function updateCookieOnExpand( id )
{
  var cookie = readCookie(cookieNameOpenNodes);
  if (!cookie)
    cookie = id;
   else if(!cookie.split(",").includes(id))
    cookie += "," + id;
  createCookie(cookieNameOpenNodes, cookie, 14);
}

function updateCookieOnCollapse(id)
{
  var cookie = readCookie(cookieNameOpenNodes);
  let openNodes = cookie ? cookie.split(",").filter((node) => node.length == 8) : [];
  const index = openNodes.indexOf(id);
  if (index >= 0) openNodes.splice(index, 1);
  cookie = openNodes.join(",");
  createCookie(cookieNameOpenNodes, cookie, cookie ? 14 : -1);
}

async function openNodesOnPageLoad(descend = false)
{
  let dom_changed = false;
  const cookie = readCookie(cookieNameOpenNodes);
  // drop elements that are no hashes, which have 8 hex characters
  let openNodes = cookie ? cookie.split(",").filter((node) => node.length == 8) : [];
  for (const fldr_hash of openNodes) {
    dom_changed |= await set_folder_open(fldr_hash, descend, false);
  }
  dom_changed |= await restoreSelection(descend);
  if (dom_changed && typeof liveEnhanced !== 'undefined') liveEnhanced.domReadySetup();
  imgLoad();
}

function filterRecordings(filter, currentSort, currentFlat, recycle_bin)
{
  window.location.href = "recordings.html?sort=" + currentSort + "&flat=" + currentFlat + "&filter=" + encodeURIComponent(filter.value) + "&recycle_bin=" + recycle_bin;
}
function deletedRecordings(recycle_bin, currentSort, currentFlat, currentFilter)
{
  if (recycle_bin.checked) {
    window.location.href = "recordings.html?sort=" + currentSort + "&flat=" + currentFlat + "&filter=" + currentFilter + "&recycle_bin=1";
  } else {
    window.location.href = "recordings.html?sort=" + currentSort + "&flat=" + currentFlat + "&filter=" + currentFilter + "&recycle_bin=0";
  }
}

async function expandFolder(fldr_hash, descend = false)
{
  var dom_changed = await set_folder_open(fldr_hash);
  const folder = fldr_ids[fldr_hash];
  if (folder) {
    for (const sub_fldr_hash of descend ? fldr_ids[fldr_hash].fldr_ids : []) {
      dom_changed |= await expandFolder(sub_fldr_hash, descend);
    }
  }
  return dom_changed;
}
async function ExpandAll(fldr_hash, descend = false)
{
  var dom_changed = await expandFolder(fldr_hash, true);
  if (dom_changed) {
    if (typeof liveEnhanced !== 'undefined') liveEnhanced.domReadySetup();
    imgLoad();
  }
}

function collapseFolder(fldr_hash, descend = false)
{
  const folder = fldr_ids[fldr_hash];
  if (folder) {
    for (const sub_fldr_hash of descend ? folder.fldr_ids : []) {
      collapseFolder(sub_fldr_hash, descend);
    }
  }
  set_folder_closed(fldr_hash, descend);
}
function CollapseAll(fldr_hash, descend = false)
{
  if (!descend) uncheckAllRecordings(fldr_hash, true);
  collapseFolder(fldr_hash, true);
  eraseCookie(cookieNameOpenNodes);
}

const cookieNamePrefix = "VDR-Live-Recordings-Tree";
const cookieNameOpenNodes = cookieNamePrefix + "-Open-Nodes";
const cookieNameSelection = cookieNamePrefix + "-Selection";

//The following cookie functions have evolved from the examples of http://www.quirksmode.org/js/cookies.html

function createCookie(name, value, days)
{
  const scope = "; SameSite=Lax; path=/"
  var expiration = "";   // defaults to session cookie
  if (days > 0) {
    // cookie with expiration time
    let date = new Date();
    date.setTime(date.getTime() + days * 24*60*60*1000);
    expiration = "; expires=" + date.toGMTString();
  } else if (days < 0) {
    // already expired cookie, i.e., cookie to be deleted
    let date = new Date(0);
    expiration = "; expires=" + date.toGMTString();
  }
  var cookie = name + "=" + value + expiration + scope;
  if (cookie.length >= 4096 ) {
    // oversized cookie deleted to avoid truncation issues
    let date = new Date(0);
    expiration = "; expires=" + date.toGMTString();
    cookie = name + "=" + expiration + scope;
  }
  document.cookie = cookie;
}

function readCookie(name)
{
  var nameEQ = name + "=";
  for (let c of document.cookie.split(';')) {
    c = c.trim();
    if (c.startsWith(nameEQ)) return c.substring(nameEQ.length);
  }
  return null;
}

function eraseCookie(name)
{
  createCookie(name, "", -1);
}
