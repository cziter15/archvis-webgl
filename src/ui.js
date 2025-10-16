// UI module: DOM-only helpers and editors
// Initialize with dependencies from main.js via init(deps)
import { findNodeById } from './archmodel.js';
let D = {
  getArchitecture: null,
  setArchitecture: null,
  getSelectedId: null,
  getSelectedNode: null,
  setSelectedId: null,
  setSelectedNode: null,
  getEditMode: null,
  setEditMode: null,
  findNodeById: null,
  rebuildScene: null,
  updateSceneNodeColor: null,
  archRenderer: null
};

// internal UI-owned edit mode flag
let uiEditMode = false;

export function getEditMode() {
  return !!uiEditMode;
}

export function setEditMode(v) {
  uiEditMode = !!v;
  // keep MainApp in sync if provided
  try { if (D && D.app) D.app.editMode = uiEditMode; } catch(e) {}
  // apply DOM changes: mirror logic that was originally in wireUiHandlers
  if (uiEditMode) {
    try { renderLegendEditor(); renderLegendAssignSelect(); } catch(e) {}
    const nodeHeader = document.getElementById('nodeEditorHeader'); if (nodeHeader) nodeHeader.style.display = '';
    const editPanel = document.getElementById('editPanel'); if (editPanel) { editPanel.style.display = ''; editPanel.setAttribute('aria-hidden','false'); }
    ensureSelectedIndicator(); ensureRenameInput();
    addMessage('Edit mode enabled: use gizmo arrows to move nodes, double-click to rename.');
    const legendEditor = document.getElementById('legendEditor'); if (legendEditor) legendEditor.style.display = '';
    // hide primary actions while editing
    ['saveBtn','loadBtn','sampleBtn'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      try { el.dataset._wasHiddenByEdit = el.style.display === 'none' ? '1' : ''; } catch(e){}
      el.style.display = 'none';
    });
    const smooth = document.querySelector('.smoothness-control'); if (smooth) { try { smooth.dataset._wasHiddenByEdit = smooth.style.display === 'none' ? '1' : ''; } catch(e){} smooth.style.display = 'none'; }
  } else {
    const nodeHeader = document.getElementById('nodeEditorHeader'); if (nodeHeader) nodeHeader.style.display = 'none';
    const editPanel = document.getElementById('editPanel'); if (editPanel) { editPanel.style.display = 'none'; editPanel.setAttribute('aria-hidden','true'); }
    const selInd = window.__selectedIndicatorElement; if (selInd) selInd.style.display = 'none';
    const renameIn = window.__renameInputEl; if (renameIn) renameIn.style.display = 'none';
    try { D.archRenderer && D.archRenderer.hideGizmo(); } catch (e) {}
    addMessage('Edit mode disabled. Auto-rotate will resume after inactivity.');
    const legendEditor = document.getElementById('legendEditor'); if (legendEditor) legendEditor.style.display = 'none';
    // restore primary actions visibility
    ['saveBtn','loadBtn','sampleBtn'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      try {
        if (el.dataset && el.dataset._wasHiddenByEdit) { delete el.dataset._wasHiddenByEdit; }
        else { el.style.display = ''; }
      } catch(e) { el.style.display = ''; }
    });
    const smooth = document.querySelector('.smoothness-control'); if (smooth) { try { if (smooth.dataset && smooth.dataset._wasHiddenByEdit) { delete smooth.dataset._wasHiddenByEdit; } else { smooth.style.display = ''; } } catch(e) { smooth.style.display = ''; } }
  }
  // update edit button text/state
  const btn = document.getElementById('editBtn'); if (btn) { btn.classList.toggle('active', uiEditMode); btn.textContent = uiEditMode ? '✖️ EXIT EDITOR' : '✏️ EDIT'; }
  }

export function init(deps) {
  D = Object.assign(D, deps || {});
  // ensure basic UI wiring runs
  try { renderLegendAssignSelect(); } catch (e) {}
  try { renderLegendEditor(); } catch (e) {}
  // attach handlers for edit workflow: wire top-level buttons and immediate edit inputs
  try { attachImmediateEditHandlers(); } catch (e) { console.warn('attachImmediateEditHandlers failed', e); }
  try { wireUiHandlers(); } catch (e) { console.warn('wireUiHandlers failed', e); }
  // wire internal edit-mode accessors into D
  D.getEditMode = getEditMode;
  D.setEditMode = setEditMode;
}

// Simple UI message helper
export function addMessage(text) {
  try {
    const messageDisplay = document.getElementById('messageDisplay');
    if (!messageDisplay) return;
    const msg = document.createElement('div');
    msg.className = 'message';
    msg.textContent = text;
    messageDisplay.appendChild(msg);
    setTimeout(() => { try { messageDisplay.removeChild(msg); } catch (e) {} }, 5000);
  } catch (e) {
    console.warn('addMessage failed', e);
  }
}

// Set panels visible
export function setPanelsVisible(visible) {
  const rp = document.getElementById('rightPanel');
  const lp = document.getElementById('leftPanel');
  if (rp) rp.style.display = visible ? 'block' : 'none';
  if (lp) lp.style.display = visible ? 'block' : 'none';
}

// Left panel legend display
export function updateLeftLegendDisplay() {
  const items = document.getElementById('legendItems');
  const container = document.getElementById('legendContainer');
  if (!items) return;
  items.innerHTML = '';
  const arch = D.getArchitecture ? D.getArchitecture() : { legend: [] };
  const legend = arch.legend || [];
  legend.forEach((entry) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    row.style.marginBottom = '6px';
    const sw = document.createElement('div');
    sw.style.width = '12px';
    sw.style.height = '12px';
    sw.style.background = entry.color || '#00ffff';
    sw.style.border = '1px solid rgba(255,255,255,0.1)';
    sw.style.boxSizing = 'border-box';
    const name = document.createElement('div');
    name.style.color = '#00ffff';
    name.style.fontSize = '12px';
    name.textContent = entry.name || '';
    row.appendChild(sw);
    row.appendChild(name);
    items.appendChild(row);
  });
  if (container) container.style.display = legend.length ? '' : 'none';
}

// Legend editor (dom building)
export function renderLegendEditor() {
  const list = document.getElementById('legendList');
  if (!list) return;
  list.innerHTML = '';
  const arch = D.getArchitecture ? D.getArchitecture() : { legend: [] };
  const legend = arch.legend || [];
  const editMode = D.getEditMode ? D.getEditMode() : false;
  legend.forEach((entry, idx) => {
    // ensure each legend entry has an id
    if (!entry.id) entry.id = (Math.random().toString(36).slice(2,9));
    const row = document.createElement('div');
    row.className = 'legend-row';
    if (editMode) {
      row.innerHTML = `
        <input type="text" class="legend-name" data-idx="${idx}" value="${entry.name}" />
        <div class="legend-swatch" data-idx="${idx}" title="Click to change color" style="width:28px;height:28px;border:1px solid #00ffff;background:${entry.color};box-sizing:border-box;cursor:pointer;"></div>
        <button class="button small legend-remove" data-idx="${idx}">DEL</button>
      `;
    } else {
      row.innerHTML = `
        <div style="flex:1;color:#00ffff;">${entry.name}</div>
        <div style="width:12px;height:12px;background:${entry.color};border:1px solid rgba(255,255,255,0.1);"></div>
      `;
    }
    list.appendChild(row);
  });

  if (editMode) {
    list.querySelectorAll('.legend-name').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        const arch2 = D.getArchitecture ? D.getArchitecture() : { legend: [] };
        if (!arch2.legend[i]) return;
        arch2.legend[i].name = e.target.value;
        // notify main to update
        try { updateLeftLegendDisplay(); } catch (e) {}
        try { renderLegendAssignSelect(); } catch (e) {}
      });
    });
    list.querySelectorAll('.legend-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        const i = parseInt(swatch.dataset.idx, 10);
        const arch2 = D.getArchitecture ? D.getArchitecture() : { legend: [] };
        if (isNaN(i) || !arch2.legend[i]) return;
        const current = arch2.legend[i].color || '#00ffff';
        openColorPickerNear(swatch, current, (val) => {
          arch2.legend[i].color = val;
          try { updateLeftLegendDisplay(); } catch (e) {}
          try { D.rebuildScene && D.rebuildScene(); } catch (e) {}
        });
      });
    });
    list.querySelectorAll('.legend-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        const arch3 = D.getArchitecture ? D.getArchitecture() : { legend: [] };
        if (i >= 0 && i < arch3.legend.length) {
          arch3.legend.splice(i, 1);
          try { updateLeftLegendDisplay(); } catch (e) {}
          try { renderLegendAssignSelect(); } catch (e) {}
        }
      });
    });
  }
}

// wire top-level legend add controls (newLegendName, newLegendSwatch, addLegendBtn)
function _wireLegendAddControls() {
  try {
    const nameEl = document.getElementById('newLegendName');
    const swatch = document.getElementById('newLegendSwatch');
    const addBtn = document.getElementById('addLegendBtn');
    if (!nameEl || !swatch || !addBtn) return;
    // color picker on swatch
    swatch.addEventListener('click', (e) => {
      const current = swatch.style.background || '#00ffff';
      openColorPickerNear(swatch, current, (val) => {
        swatch.style.background = val;
      });
    });
    addBtn.addEventListener('click', (e) => {
      const name = (nameEl.value || '').trim();
      if (!name) { addMessage('Legend name required'); return; }
      const color = swatch.style.background || '#00ffff';
      const arch = D.getArchitecture ? D.getArchitecture() : null;
      if (!arch) return;
      if (!arch.legend) arch.legend = [];
      const id = (Math.random().toString(36).slice(2,9));
      arch.legend.push({ id, name, color });
      try { updateLeftLegendDisplay(); } catch (e) {}
      try { renderLegendEditor(); } catch (e) {}
      try { renderLegendAssignSelect(); } catch (e) {}
      try { D.rebuildScene && D.rebuildScene(); } catch (e) {}
      nameEl.value = '';
    });
  } catch (err) { console.warn('wireLegendAddControls failed', err); }
}

// open color input
export function openColorPickerNear(anchorEl, initialColor, onPick) {
  try {
    const rect = anchorEl.getBoundingClientRect();
    const input = document.createElement('input');
    input.type = 'color';
    input.value = initialColor || '#00ffff';
    input.style.position = 'absolute';
    input.style.left = (rect.left + window.scrollX) + 'px';
    input.style.top = (rect.top + window.scrollY) + 'px';
    input.style.width = (rect.width) + 'px';
    input.style.height = (rect.height) + 'px';
    input.style.zIndex = 100000;
    input.style.border = 'none';
    input.style.padding = '0';
    input.style.margin = '0';
    input.style.background = 'transparent';
    input.style.opacity = '0.01';
    document.body.appendChild(input);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      try { input.remove(); } catch (e) {}
      try { document.removeEventListener('mousedown', onDocClick, true); } catch(e) {}
      try { clearTimeout(timeoutId); } catch(e) {}
    };
    const doPick = (val) => { try { if (onPick) onPick(val); } catch (e) { console.warn('onPick handler error', e); } };
    input.addEventListener('input', (e) => { doPick(e.target.value); });
    input.addEventListener('change', (e) => { doPick(e.target.value); cleanup(); });
    input.addEventListener('blur', () => { setTimeout(cleanup, 200); });
    const onDocClick = (ev) => { if (!input.contains(ev.target)) cleanup(); };
    document.addEventListener('mousedown', onDocClick, true);
    const timeoutId = setTimeout(() => { cleanup(); }, 6000);
    input.click();
  } catch (err) {
    console.warn('color picker fallback', err);
  }
}

// assign select
export function renderLegendAssignSelect() {
  const sel = document.getElementById('assignLegendSelect');
  if (!sel) return;
  sel.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '-- none --';
  sel.appendChild(blank);
  const arch = D.getArchitecture ? D.getArchitecture() : { legend: [] };
  (arch.legend || []).forEach((entry) => {
    const opt = document.createElement('option');
    opt.value = entry.id || entry.name;
    opt.textContent = entry.name;
    sel.appendChild(opt);
  });
  sel.onchange = function () {
    try {
      // resolve selected node id (try D.getSelectedId, fallback to D.getSelectedNode)
      let id = null;
      if (D.getSelectedId) id = D.getSelectedId();
      if (!id && D.getSelectedNode) {
        const sn = D.getSelectedNode();
        if (sn && sn.userData && sn.userData.id) id = sn.userData.id;
      }
      if (!id) { console.warn('assignLegendSelect: no selected id'); return; }
      const sceneNode = D.getSelectedNode ? D.getSelectedNode() : (D.archRenderer ? D.archRenderer.getSceneNodeById(id) : null);
      const selectedLegendId = sel.value === '' ? '' : sel.value;
      const arch = D.getArchitecture ? D.getArchitecture() : null;
      const archNode = D.findNodeById && arch ? D.findNodeById(arch.root, id) : null;
      if (!archNode) { console.warn('assignLegendSelect: arch node not found', id); return; }
      if (!selectedLegendId) delete archNode.category; else archNode.category = selectedLegendId;
      // refresh scene and UI so change is visible immediately
      try { D.rebuildScene && D.rebuildScene(); } catch (e) { console.warn('rebuildScene failed', e); }
      try { updateLeftLegendDisplay(); } catch (e) {}
      try { renderLegendAssignSelect(); } catch (e) {}
      try { if (typeof populateEditPanelForSelected === 'function') populateEditPanelForSelected(); } catch (e) {}
      try { updateSelectedIndicatorPosition(); } catch (e) {}
    } catch (err) { console.error('assignLegendSelect onchange error', err); }
  };
}

export function updateLegend() {
  try { updateLeftLegendDisplay(); } catch (e) { console.warn(e); }
  try { renderLegendEditor(); } catch (e) {}
  try { renderLegendAssignSelect(); } catch (e) {}
}

export function updateTitle() {
  const titleEl = document.getElementById('title');
  const arch = D.getArchitecture ? D.getArchitecture() : {};
  const t = (arch && arch.uiInfo && arch.uiInfo.title) ? arch.uiInfo.title : (arch && arch.root && arch.root.name) ? arch.root.name : 'ARCHITECTURE VISUALIZATION';
  if (titleEl) titleEl.textContent = t;
  try { document.title = t; } catch (e) {}
}

// Populate edit panel with selected node data
export function populateEditPanelForSelected() {
  const panel = document.getElementById('editPanel');
  if (!panel) return;
  // never show edit panel when not in edit mode
  if (!D.getEditMode()) {
    panel.style.display = 'none';
    panel.setAttribute('aria-hidden', 'true');
    return;
  }
  const editContent = document.getElementById('editContent');
  // resolve transient scene node from selectedId if needed
  const selectedNode = D.getSelectedNode ? D.getSelectedNode() : (D.getSelectedId() ? D.archRenderer.getSceneNodeById(D.getSelectedId()) : null);
  if (!selectedNode) {
    // show friendly message
    panel.style.display = 'block';
    panel.setAttribute('aria-hidden', 'false');
    if (editContent) {
      editContent.innerHTML = '<div style="color:#00ffff;font-size:12px;padding:6px;">Select a node to edit it</div>';
    }
    return;
  }
  // find architecture node
  const arch = D.getArchitecture();
  const archNode = findNodeById(arch.root, selectedNode.userData.id) || (arch.root.name === selectedNode.userData.name ? arch.root : null);
  // fallback: try matching by name
  const nameMatch = !archNode && (arch.root.name === selectedNode.userData.name ? arch.root : null);

  panel.style.display = 'block';
  panel.setAttribute('aria-hidden', 'false');
  const nameIn = document.getElementById('editName');
  const scaleIn = document.getElementById('editScale');
  const posX = document.getElementById('editPosX');
  const posY = document.getElementById('editPosY');
  const posZ = document.getElementById('editPosZ');

  const source = archNode || nameMatch ? (archNode || nameMatch) : null;
  if (source) {
    // ensure the full form is present in editContent (in case we previously showed the message)
    const editContent = document.getElementById('editContent');
    if (editContent && editContent.querySelector('#editName') == null) {
      // rebuild inner HTML to include inputs (simple approach)
      editContent.innerHTML = `
        <div class="edit-row"><label>Name</label><input type="text" id="editName"></div>
        <div style="display:flex;gap:8px;margin-top:8px;align-items:center;"><select id="assignLegendSelect" style="flex:1;padding:6px;background:rgba(0,0,0,0.6);border:1px solid #00ffff;color:#00ffff;"></select></div>
        <div class="edit-row"><label>Scale</label><input type="number" id="editScale" step="0.1" min="0.1"></div>
        <div class="edit-row"><label>Pos X</label><input type="number" id="editPosX" step="0.1"></div>
        <div class="edit-row"><label>Pos Y</label><input type="number" id="editPosY" step="0.1"></div>
        <div class="edit-row"><label>Pos Z</label><input type="number" id="editPosZ" step="0.1"></div>
        <div class="edit-actions"><button class="button small" id="addChildBtn">+ CHILD</button><button class="button small danger" id="deleteNodeBtn">DELETE</button></div>
      `;
      // re-wire the add/delete handlers (they already exist on document load, so no-op if present)
      try { attachImmediateEditHandlers(); } catch (e) { console.warn('attachImmediateEditHandlers failed', e); }
    }
    // now set values
    const nameIn2 = document.getElementById('editName');
    const scaleIn2 = document.getElementById('editScale');
    const posX2 = document.getElementById('editPosX');
    const posY2 = document.getElementById('editPosY');
    const posZ2 = document.getElementById('editPosZ');
    if (nameIn2) nameIn2.value = source.name || selectedNode.userData.name || '';
    if (scaleIn2) scaleIn2.value = source.scale || 1;
    if (posX2) posX2.value = (selectedNode.position.x || 0).toFixed(2);
    if (posY2) posY2.value = (selectedNode.position.y || 0).toFixed(2);
    if (posZ2) posZ2.value = (selectedNode.position.z || 0).toFixed(2);
  } else {
    // fallback: ensure base inputs exist and populate them
    if (nameIn) nameIn.value = selectedNode.userData.name || '';
    if (scaleIn) scaleIn.value = 1;
    if (posX) posX.value = (selectedNode.position.x || 0).toFixed(2);
    if (posY) posY.value = (selectedNode.position.y || 0).toFixed(2);
    if (posZ) posZ.value = (selectedNode.position.z || 0).toFixed(2);
  }

  // update legend assign select options and select current category if any
  try { renderLegendAssignSelect(); } catch (e) { /* ignore */ }
  const sel = document.getElementById('assignLegendSelect');
  if (sel) {
    // determine current category for this selected node from architecture (category stores legend id)
    const archNodeForCategory = findNodeById(arch.root, selectedNode.userData.id);
    let current = '';
    if (archNodeForCategory && archNodeForCategory.category) {
      current = archNodeForCategory.category;
    }
    // If current is numeric index (legacy), try to map to legend id
    if (current !== '') {
      const maybeIndex = parseInt(current, 10);
      if (!isNaN(maybeIndex) && arch.legend && arch.legend[maybeIndex]) {
        current = arch.legend[maybeIndex].id;
      } else {
        // ensure the id exists; if not, try to find by name
        const foundById = (arch.legend || []).find(e => e.id === current);
        if (!foundById) {
          const foundByName = (arch.legend || []).find(e => e.name === current);
          if (foundByName) current = foundByName.id;
          else current = '';
        }
      }
    }
    sel.value = current || '';
  }
}

// Selected indicator and rename input builders
export function ensureSelectedIndicator() {
  if (window.__selectedIndicatorElement) return window.__selectedIndicatorElement;
  const el = document.createElement('div'); el.className = 'selected-node-indicator'; el.style.display = 'none'; document.body.appendChild(el); window.__selectedIndicatorElement = el; return el;
}
export function ensureRenameInput() {
  if (window.__renameInputEl) return window.__renameInputEl;
  const el = document.createElement('input'); el.type = 'text'; el.style.position = 'absolute'; el.style.zIndex = 90; el.style.display = 'none'; el.style.padding = '6px 8px'; el.style.border = '1px solid #00ffff'; el.style.background = 'rgba(0,0,0,0.8)'; el.style.color = '#00ffff'; el.style.fontFamily = 'Orbitron, sans-serif'; document.body.appendChild(el); window.__renameInputEl = el; return el;
}
export function showRenameInputAtSelected() {
  const renameInput = ensureRenameInput();
  const id = D.getSelectedId ? D.getSelectedId() : null;
  const sceneNode = D.getSelectedNode ? D.getSelectedNode() : (D.archRenderer ? D.archRenderer.getSceneNodeById(id) : null);
  if (!sceneNode) return;
  const pos = sceneNode.position.clone();
  const projected = pos.project(D.archRenderer.camera);
  const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
  renameInput.style.left = (x + 24) + 'px';
  renameInput.style.top = (y - 12) + 'px';
  renameInput.value = sceneNode.userData.name || '';
  renameInput.style.display = 'block';
  renameInput.focus();
}

export function updateSelectedIndicatorPosition() {
  const el = window.__selectedIndicatorElement;
  if (!el) return;
  const id = D.getSelectedId ? D.getSelectedId() : null;
  const sceneNode = D.getSelectedNode ? D.getSelectedNode() : (D.archRenderer ? D.archRenderer.getSceneNodeById(id) : null);
  // hide indicator if not in edit mode or no node selected
  if (!D.getEditMode || !D.getEditMode() || !sceneNode) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  const pos = sceneNode.position.clone();
  const projected = pos.project(D.archRenderer.camera);
  const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
  const y = ( -projected.y * 0.5 + 0.5) * window.innerHeight;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
}

// attachImmediateEditHandlers: wired to inputs in edit panel
export function attachImmediateEditHandlers() {
  const nameIn = document.getElementById('editName');
  const scaleIn = document.getElementById('editScale');
  const posX = document.getElementById('editPosX');
  const posY = document.getElementById('editPosY');
  const posZ = document.getElementById('editPosZ');
  const applyChanges = () => {
    const id = D.getSelectedId ? D.getSelectedId() : null;
    if (!id) return;
    const sceneNode = D.getSelectedNode ? D.getSelectedNode() : (D.archRenderer ? D.archRenderer.getSceneNodeById(id) : null);
    if (!sceneNode) return;
    const newName = nameIn.value.trim();
    const newScale = parseFloat(scaleIn.value) || 1;
    const x = parseFloat(posX.value) || 0;
    const y = parseFloat(posY.value) || 0;
    const z = parseFloat(posZ.value) || 0;
    sceneNode.userData.name = newName;
    sceneNode.position.set(x,y,z);
  const arch = D.getArchitecture ? D.getArchitecture() : null;
  const archNode = D.findNodeById && arch ? D.findNodeById(arch.root, id) : null;
    if (archNode) { archNode.name = newName; archNode.scale = newScale; archNode.pos = [x,y,z]; }
    try { D.rebuildScene && D.rebuildScene(); } catch (e) {}
  };
  if (nameIn) nameIn.addEventListener('change', applyChanges);
  if (scaleIn) scaleIn.addEventListener('change', applyChanges);
  if (posX) posX.addEventListener('change', applyChanges);
  if (posY) posY.addEventListener('change', applyChanges);
  if (posZ) posZ.addEventListener('change', applyChanges);
}

// wireUiHandlers: attach top-level UI buttons
export function wireUiHandlers() {
  const attachOnce = (id, event, fn) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.dataset && el.dataset.wired) return;
    el.addEventListener(event, fn);
    el.dataset.wired = '1';
  };
  attachOnce('editBtn', 'click', () => {
    if (!D.getEditMode || !D.setEditMode) return;
    if (!D.getEditMode()) { if (window.innerWidth < 900) { addMessage('Edit mode is available on desktop only.'); return; } }
    D.setEditMode(!D.getEditMode());
    const btn = document.getElementById('editBtn'); if (btn) { btn.classList.toggle('active', D.getEditMode()); btn.textContent = D.getEditMode() ? '✖️ EXIT EDITOR' : '✏️ EDIT'; }
    if (D.getEditMode()) {
      renderLegendEditor(); renderLegendAssignSelect();
      const nodeHeader = document.getElementById('nodeEditorHeader'); if (nodeHeader) nodeHeader.style.display = '';
      const editPanel = document.getElementById('editPanel'); if (editPanel) { editPanel.style.display = ''; editPanel.setAttribute('aria-hidden','false'); }
      ensureSelectedIndicator(); ensureRenameInput();
      addMessage('Edit mode enabled: use gizmo arrows to move nodes, double-click to rename.');
      const legendEditor = document.getElementById('legendEditor'); if (legendEditor) legendEditor.style.display = '';
      // hide primary actions while editing
      ['saveBtn','loadBtn','sampleBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        // remember if it was already hidden
        try { el.dataset._wasHiddenByEdit = el.style.display === 'none' ? '1' : ''; } catch(e){}
        el.style.display = 'none';
      });
      const smooth = document.querySelector('.smoothness-control'); if (smooth) { try { smooth.dataset._wasHiddenByEdit = smooth.style.display === 'none' ? '1' : ''; } catch(e){} smooth.style.display = 'none'; }
    } else {
      const nodeHeader = document.getElementById('nodeEditorHeader'); if (nodeHeader) nodeHeader.style.display = 'none';
      const editPanel = document.getElementById('editPanel'); if (editPanel) { editPanel.style.display = 'none'; editPanel.setAttribute('aria-hidden','true'); }
      const selInd = window.__selectedIndicatorElement; if (selInd) selInd.style.display = 'none';
      const renameIn = window.__renameInputEl; if (renameIn) renameIn.style.display = 'none';
      try { D.archRenderer && D.archRenderer.hideGizmo(); } catch (e) {}
      addMessage('Edit mode disabled. Auto-rotate will resume after inactivity.');
      const legendEditor = document.getElementById('legendEditor'); if (legendEditor) legendEditor.style.display = 'none';
      // restore primary actions visibility
      ['saveBtn','loadBtn','sampleBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        try {
          if (el.dataset && el.dataset._wasHiddenByEdit) { delete el.dataset._wasHiddenByEdit; }
          else { el.style.display = ''; }
        } catch(e) { el.style.display = ''; }
      });
      const smooth = document.querySelector('.smoothness-control'); if (smooth) { try { if (smooth.dataset && smooth.dataset._wasHiddenByEdit) { delete smooth.dataset._wasHiddenByEdit; } else { smooth.style.display = ''; } } catch(e) { smooth.style.display = ''; } }
    }
  });

  // wire legend add controls once
  try { _wireLegendAddControls(); } catch (e) {}
}

// include get/set edit mode in the default export for external callers
export default { init, addMessage, setPanelsVisible, updateLeftLegendDisplay, renderLegendEditor, renderLegendAssignSelect, updateLegend, updateTitle, populateEditPanelForSelected, ensureSelectedIndicator, ensureRenameInput, showRenameInputAtSelected, updateSelectedIndicatorPosition, attachImmediateEditHandlers, wireUiHandlers, getEditMode, setEditMode };
