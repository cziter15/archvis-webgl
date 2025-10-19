/*
 *	Copyright (c) 2025-2026, Krzysztof Strehlau
 *
 *	This file is a part of the ArchVis WebGL utility.
 *	All licensing information can be found inside LICENSE.md file.
 *
 *	https://github.com/cziter15/archvis-webgl/blob/main/LICENSE
 */
import { ArchModel } from './model.js';

export class UI {
  constructor(app) {
    this.app = app;
    this.editMode = false;
    this.eventListeners = new Map();
    this.isMobile = this.detectMobile();
    if (this.app?.model?.onChange) {
      this.app.model.onChange(() => {
        this.updateLegendDisplay();
        if (this.editMode) this.renderLegendEditor();
        this.populateEditPanel();
        this._updateTitleFromModel();
      });
    }
    if (this.app?.model?.onSelect) {
      this.app.model.onSelect((id) => { this.populateEditPanel(); });
    }
    this.wireAll();
    this.updateMobileUI();
    try {
      this.setVisibility('legendEditor', false);
      this.setVisibility('editPanel', false);
    } catch (e) { }
  }

  detectMobile() {
    try {
      if (typeof window === 'undefined') return false;
      const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();
      const isMobileUA = /android|iphone|ipad|ipod|opera mini|iemobile|mobile/.test(ua);
      const hasTouch = !!(navigator && navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
      const narrowScreen = (typeof window !== 'undefined') ? window.innerWidth <= 900 : false;
      return isMobileUA || (hasTouch && narrowScreen);
    } catch (e) { return false; }
  }

  setEditMode(active) {
    this.editMode = active;
    const btn = document.getElementById('editBtn');
    if (btn) { btn.classList.toggle('active', active); btn.textContent = active ? '\u2716 EXIT EDITOR' : '\u270f\ufe0f EDIT'; }
    const editPanel = document.getElementById('editPanel');
    const legendEditor = document.getElementById('legendEditor');
    const smooth = document.querySelector('.smoothness-control');
    if (active) {
      this.setVisibility(editPanel || 'editPanel', true);
      this.setVisibility(legendEditor || 'legendEditor', true);
      this.setVisibility(smooth, false);
      this.addMessage('Edit mode: use arrows to move nodes');
      if (this.app?.model && typeof this.app.model.setSelected === 'function') this.app.model.setSelected(null);
      this.renderLegendEditor();
      this.renderEmptyEditPanel();
    } else {
      this.setVisibility(editPanel || 'editPanel', false);
      this.setVisibility(legendEditor || 'legendEditor', false);
      this.setVisibility(smooth, true);
      this._setButtonsVisibility(['saveBtn', 'loadBtn', 'sampleBtn'], true);
      this.addMessage('Edit mode disabled');
      const selId = this.app?.model?.getSelected ? this.app.model.getSelected() : null;
      const selNode = selId ? this.app.renderer.getNodeById(selId) : null;
  if (selNode && this.app?.model && typeof this.app.model.setSelected === 'function') this.app.model.setSelected(null);
    }
  }

  _setButtonsVisibility(ids, show) { ids.forEach(id => this.setVisibility(id, !!show)); }

  addMessage(text) {
    const display = document.getElementById('messageDisplay');
    if (!display) return;
    const msg = document.createElement('div');
    msg.className = 'message';
    msg.textContent = text;
    display.appendChild(msg);
    setTimeout(() => display.removeChild(msg), 5000);
  }

  updateLegendDisplay() {
    const container = document.getElementById('legendItems');
    if (!container) return;
    container.innerHTML = '';
    if (!this.app.model.legend) this.app.model.legend = [];
    this.setVisibility('legendContainer', (this.app.model.legend || []).length > 0);
    (this.app.model.legend || []).forEach(entry => {
      const row = document.createElement('div');
      row.className = 'legend-entry';
      const swatch = document.createElement('div');
      swatch.className = 'legend-color';
      swatch.style.backgroundColor = entry.color;
      const name = document.createElement('div');
      name.textContent = entry.name;
      row.appendChild(swatch);
      row.appendChild(name);
      container.appendChild(row);
    });
  }

  renderLegendEditor() {
    const list = document.getElementById('legendList');
    if (!list) return;
    this._clearEventListeners(list);
    list.innerHTML = '';
    if (!this.app.model.legend) this.app.model.legend = [];
    (this.app.model.legend || []).forEach((entry, idx) => {
      if (!entry.id) entry.id = Math.random().toString(36).slice(2, 9);
      const row = document.createElement('div');
      row.className = 'legend-row';
      if (this.editMode) {
        row.innerHTML = `
  <input type="text" class="legend-name" data-idx="${idx}" value="${entry.name}" />
  <div class="legend-swatch" data-idx="${idx}" style="background:${entry.color};"></div>
  <button class="button small legend-remove" data-idx="${idx}">DEL</button>
`;
      } else {
        row.innerHTML = `
  <div class="legend-name">${entry.name}</div>
  <div class="legend-color" style="background:${entry.color};"></div>
`;
      }
      list.appendChild(row);
    });

  this.setVisibility('legendEditor', !!this.editMode);
    if (this.editMode) this._setupLegendEventListeners(list);
  }

  _setupLegendEventListeners(list) {
    list.querySelectorAll('.legend-name').forEach(inp => {
      const listener = (e) => {
        const i = parseInt(e.target.dataset.idx);
        this.app.model.legend[i].name = e.target.value;
        this.updateLegendDisplay();
        this.renderLegendAssignSelect();
      };
      inp.addEventListener('change', listener);
      this._addEventListener(inp, 'change', listener);
    });
    list.querySelectorAll('.legend-swatch').forEach(swatch => {
      const listener = () => {
        const i = parseInt(swatch.dataset.idx);
        this.openColorPicker(swatch, this.app.model.legend[i].color, (color) => {
          this.app.model.legend[i].color = color;
          this.updateLegendDisplay();
          if (this.app.model && typeof this.app.model.update === 'function') this.app.model.update(() => {}, { type: 'legend-changed' }, { debounceMs: 60 });
          else if (this.app.model && typeof this.app.model.emitChange === 'function') this.app.model.emitChange({ type: 'legend-changed' });
        });
      };
      swatch.addEventListener('click', listener);
      this._addEventListener(swatch, 'click', listener);
    });
    list.querySelectorAll('.legend-remove').forEach(btn => {
      const listener = (e) => {
        const i = parseInt(e.target.dataset.idx);
        this.app.model.legend.splice(i, 1);
        this.updateLegendDisplay();
        this.renderLegendAssignSelect();
        if (this.app.model && typeof this.app.model.update === 'function') this.app.model.update(() => {}, { type: 'legend-changed' }, { debounceMs: 60 });
        else if (this.app.model && typeof this.app.model.emitChange === 'function') this.app.model.emitChange({ type: 'legend-changed' });
      };
      btn.addEventListener('click', listener);
      this._addEventListener(btn, 'click', listener);
    });
  }

  renderLegendAssignSelect() {
    const sel = document.getElementById('assignLegendSelect');
    if (!sel) return;
    this._clearEventListeners(sel);
    sel.innerHTML = '<option value="">-- none --</option>';
    if (!this.app.model.legend) this.app.model.legend = [];
    (this.app.model.legend || []).forEach(entry => {
      const opt = document.createElement('option'); opt.value = entry.id; opt.textContent = entry.name; sel.appendChild(opt);
    });
    const listener = () => {
      const selId = this.app?.model?.getSelected ? this.app.model.getSelected() : null;
      const sceneNode = selId ? this.app.renderer.getNodeById(selId) : null;
      if (!sceneNode?.userData) return;
      const id = sceneNode.userData.id;
      const node = ArchModel.findById(this.app.model.root, id);
      if (!node) return;
      if (sel.value) node.category = sel.value; else delete node.category;
      if (this.app.model && typeof this.app.model.emitChange === 'function') this.app.model.emitChange({ type: 'legend-changed' });
    };
    sel.addEventListener('change', listener);
    this._addEventListener(sel, 'change', listener);
  }

  openColorPicker(anchor, initial, callback) {
    const input = document.createElement('input');
    input.type = 'color'; input.value = initial || '#00ffff';
    let left = (window.innerWidth / 2) + window.scrollX; let top = (window.innerHeight / 2) + window.scrollY; let width = 24; let height = 24;
    if (anchor && typeof anchor.getBoundingClientRect === 'function') {
      try { const rect = anchor.getBoundingClientRect(); left = rect.left + window.scrollX; top = rect.top + window.scrollY; width = rect.width || width; height = rect.height || height; } catch (err) {}
    }
    input.style.position = 'absolute'; input.style.left = left + 'px'; input.style.top = top + 'px'; input.style.width = Math.max(2, width) + 'px'; input.style.height = Math.max(2, height) + 'px'; input.style.opacity = '0'; input.style.padding = '0'; input.style.margin = '0'; input.style.border = 'none'; input.style.zIndex = '10000';
    document.body.appendChild(input);
    const cleanup = () => { input.remove(); };
    input.addEventListener('input', (e) => callback(e.target.value));
    input.addEventListener('change', (e) => { callback(e.target.value); cleanup(); });
    input.addEventListener('blur', () => setTimeout(cleanup, 100));
    input.click();
  }

  populateEditPanel() {
    const panel = document.getElementById('editPanel');
    const content = document.getElementById('editContent');
    if (!panel || !content) return;
    const selId = this.app?.model?.getSelected ? this.app.model.getSelected() : null;
    const sceneNode = selId ? this.app.renderer.getNodeById(selId) : null;
    if (!this.editMode || !sceneNode) { this.setVisibility(panel || 'editPanel', false); return; }
    this.setVisibility(panel || 'editPanel', true);
    const archNode = ArchModel.findById(this.app.model.root, sceneNode.userData.id);
    content.innerHTML = `
  <div class="edit-row"><label>Name</label><input type="text" id="editName" value="${archNode?.name || ''}"></div>
  <div class="flex-row"><select id="assignLegendSelect" class="assign-legend-select"></select></div>
  <div class="edit-row"><label>Scale</label><input type="number" id="editScale" step="0.1" min="0.1" value="${archNode?.scale || 1}"></div>
  <div class="edit-row"><label>Pos X</label><input type="number" id="editPosX" step="0.1" value="${sceneNode.position.x.toFixed(2)}"></div>
  <div class="edit-row"><label>Pos Y</label><input type="number" id="editPosY" step="0.1" value="${sceneNode.position.y.toFixed(2)}"></div>
  <div class="edit-row"><label>Pos Z</label><input type="number" id="editPosZ" step="0.1" value="${sceneNode.position.z.toFixed(2)}"></div>
  <div class="edit-actions"><button type="button" class="button small" id="addChildBtn">+ CHILD</button><button type="button" class="button small danger" id="deleteNodeBtn">DELETE</button></div>
`;
    this._wireEditInputs(archNode, sceneNode);
    this.renderLegendAssignSelect();
    const sel = document.getElementById('assignLegendSelect'); if (sel && archNode?.category) sel.value = archNode.category;
  }

  renderEmptyEditPanel() { const panel = document.getElementById('editPanel'); const content = document.getElementById('editContent'); if (!panel || !content) return; this.setVisibility(panel || 'editPanel', true); content.innerHTML = '<div class="empty-edit-msg">Select a node to edit it</div>'; }

  updateEditPanelValues() {
    if (!this.editMode) return;
    const selId = this.app?.model?.getSelected ? this.app.model.getSelected() : null;
    const sceneNode = selId ? this.app.renderer.getNodeById(selId) : null;
    if (!sceneNode) return;
    const posX = document.getElementById('editPosX');
    const posY = document.getElementById('editPosY');
    const posZ = document.getElementById('editPosZ');
    if (posX && document.activeElement !== posX) posX.value = sceneNode.position.x.toFixed(2);
    if (posY && document.activeElement !== posY) posY.value = sceneNode.position.y.toFixed(2);
    if (posZ && document.activeElement !== posZ) posZ.value = sceneNode.position.z.toFixed(2);
  }

  _wireEditInputs(archNode, sceneNode) {
    if (!archNode) return;
    const nameIn = document.getElementById('editName');
    const scaleIn = document.getElementById('editScale');
    const posX = document.getElementById('editPosX');
    const posY = document.getElementById('editPosY');
    const posZ = document.getElementById('editPosZ');
    const addBtn = document.getElementById('addChildBtn');
    const delBtn = document.getElementById('deleteNodeBtn');
    const applyChanges = () => {
      const oldName = archNode.name;
      archNode.name = nameIn?.value || archNode.name;
      archNode.scale = parseFloat(scaleIn?.value) || 1;
      const pos = [parseFloat(posX?.value) || 0, parseFloat(posY?.value) || 0, parseFloat(posZ?.value) || 0];
      archNode.pos = pos;
      if (sceneNode) sceneNode.position.set(...pos);
      if (this.app.model && typeof this.app.model.update === 'function') this.app.model.update(() => {}, { type: 'node-updated', id: archNode.id, changes: { pos, name: archNode.name } }, { debounceMs: 60 });
      else if (this.app.model && typeof this.app.model.emitChange === 'function') this.app.model.emitChange({ type: 'node-updated', id: archNode.id, changes: { pos, name: archNode.name } });
    };
    [nameIn, scaleIn, posX, posY, posZ].forEach(input => { if (input) { this._clearEventListeners(input); input.addEventListener('change', applyChanges); this._addEventListener(input, 'change', applyChanges); } });
    if (addBtn) {
      this._clearEventListeners(addBtn);
      const addListener = (e) => { e.preventDefault(); e.stopPropagation(); const newNode = { id: Math.random().toString(36).slice(2, 9), name: 'New Node', pos: [ archNode.pos[0], archNode.pos[1] - 2, archNode.pos[2] ], scale: 1, children: [] }; if (!archNode.children) archNode.children = []; archNode.children.push(newNode); if (this.app.model && typeof this.app.model.emitChange === 'function') this.app.model.emitChange({ type: 'node-added', id: newNode.id, parentId: archNode.id }); };
      addBtn.addEventListener('click', addListener);
      this._addEventListener(addBtn, 'click', addListener);
    }
    if (delBtn) {
      this._clearEventListeners(delBtn);
      const deleteListener = (e) => { e.preventDefault(); e.stopPropagation(); const id = archNode.id; if (id === this.app.model.root.id) { this.addMessage('Cannot delete root node'); return; } ArchModel.deleteById(this.app.model.root, id); if (this.app.model && typeof this.app.model.setSelected === 'function') this.app.model.setSelected(null); if (this.app.model && typeof this.app.model.emitChange === 'function') this.app.model.emitChange({ type: 'node-removed', id }); };
      delBtn.addEventListener('click', deleteListener);
      this._addEventListener(delBtn, 'click', deleteListener);
    }
  }

  _addEventListener(element, event, listener) {
    if (!this.eventListeners.has(element)) this.eventListeners.set(element, new Map());
    const elementListeners = this.eventListeners.get(element);
    if (!elementListeners.has(event)) elementListeners.set(event, []);
    elementListeners.get(event).push(listener);
  }

  _clearEventListeners(element) {
    if (!this.eventListeners.has(element)) return;
    const elementListeners = this.eventListeners.get(element);
    elementListeners.forEach((listeners, event) => { listeners.forEach(listener => { element.removeEventListener(event, listener); }); });
    this.eventListeners.delete(element);
  }

  setVisibility(elOrId, visible, opts = { useHiddenClass: true, setAria: true }) {
    let el = null; if (!elOrId) return; if (typeof elOrId === 'string') el = document.getElementById(elOrId); else el = elOrId; if (!el) return;
    if (opts.className) el.classList.toggle(opts.className, !!visible); else if (opts.useHiddenClass) el.classList.toggle('hidden', !visible); else { if (!visible) el.style.display = 'none'; else el.style.display = (opts.display || 'block'); }
    if (opts.setAria) { if (!visible) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden'); }
  }

  wireAll() {
    document.getElementById('editBtn')?.addEventListener('click', () => { this.setEditMode(!this.editMode); });
    this._wireSaveButton(); this._wireLoadButton(); this._wireSampleButton(); this._wireLegendAdder(); this._wireSmoothnessControl();
    const mSave = document.getElementById('mobileSaveBtn'); const mLoad = document.getElementById('mobileLoadBtn'); const mSample = document.getElementById('mobileSampleBtn');
    if (mSave) mSave.addEventListener('click', () => document.getElementById('saveBtn')?.click());
    if (mLoad) mLoad.addEventListener('click', () => document.getElementById('loadBtn')?.click());
    if (mSample) mSample.addEventListener('click', () => document.getElementById('sampleBtn')?.click());
    this._updateTitleFromModel();
  }

  _wireSaveButton() { const saveBtn = document.getElementById('saveBtn'); if (!saveBtn) return; this._clearEventListeners(saveBtn); const listener = () => { if (!this.app.model.root?.name || this.app.model.root.name === 'Empty Architecture') { this.addMessage('No architecture to save'); return; } const xml = ArchModel.toXml(this.app.model); const blob = new Blob([xml], { type: 'application/xml' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'architecture.xml'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }; saveBtn.addEventListener('click', listener); this._addEventListener(saveBtn, 'click', listener); }

  _wireLoadButton() { const loadBtn = document.getElementById('loadBtn'); const fileInput = document.getElementById('xmlFileInput'); if (!loadBtn || !fileInput) return; this._clearEventListeners(loadBtn); this._clearEventListeners(fileInput); const loadListener = () => fileInput.click(); loadBtn.addEventListener('click', loadListener); this._addEventListener(loadBtn, 'click', loadListener); const fileListener = (e) => { const f = e.target.files?.[0]; if (!f) return; const reader = new FileReader(); reader.onload = (event) => { try { const parsed = ArchModel.fromXml(event.target.result); if (this.app.model && this.app.model.update) { this.app.model.update((m) => { m.root = parsed.root; m.legend = parsed.legend; m.uiInfo = parsed.uiInfo; }, { type: 'rebuild' }); } else { this.app.model = ArchModel.createObservable(parsed); if (this.app.model && typeof this.app.model.emitChange === 'function') this.app.model.emitChange({ type: 'rebuild' }); } this.updateLegendDisplay(); this.addMessage('Architecture loaded'); } catch (err) { const msg = err?.message ? String(err.message) : String(err); this.addMessage('Load failed: ' + msg); } }; reader.readAsText(f); }; fileInput.addEventListener('change', fileListener); this._addEventListener(fileInput, 'change', fileListener); }

  _wireSampleButton() { const sampleBtn = document.getElementById('sampleBtn'); if (!sampleBtn) return; this._clearEventListeners(sampleBtn); const listener = () => { try { const sample = ArchModel.createSample(); if (this.app.model && this.app.model.update) { this.app.model.update((m) => { m.root = sample.root; m.legend = sample.legend; m.uiInfo = sample.uiInfo; }, { type: 'rebuild' }); } else { this.app.model = ArchModel.createObservable(sample); if (this.app.model && typeof this.app.model.emitChange === 'function') this.app.model.emitChange({ type: 'rebuild' }); } this.updateLegendDisplay(); this.addMessage('Sample loaded'); } catch (err) { this.addMessage('Sample load failed'); } }; sampleBtn.addEventListener('click', listener); this._addEventListener(sampleBtn, 'click', listener); }

  _wireLegendAdder() { const newLegendName = document.getElementById('newLegendName'); const newLegendSwatch = document.getElementById('newLegendSwatch'); const addLegendBtn = document.getElementById('addLegendBtn'); if (newLegendSwatch) { this._clearEventListeners(newLegendSwatch); const swatchListener = () => { this.openColorPicker(newLegendSwatch, newLegendSwatch.style.background || '#00ffff', (color) => { newLegendSwatch.style.background = color; }); }; newLegendSwatch.addEventListener('click', swatchListener); this._addEventListener(newLegendSwatch, 'click', swatchListener); } if (addLegendBtn) { this._clearEventListeners(addLegendBtn); const addListener = (e) => { e.preventDefault(); e.stopPropagation(); const name = newLegendName?.value?.trim(); if (!name) { this.addMessage('Legend name required'); return; } if (!this.app.model.legend) this.app.model.legend = []; this.app.model.legend.push({ id: Math.random().toString(36).slice(2, 9), name, color: newLegendSwatch?.style.background || '#00ffff' }); if (newLegendName) newLegendName.value = ''; this.updateLegendDisplay(); this.renderLegendEditor(); this.renderLegendAssignSelect(); if (this.app.model && typeof this.app.model.emitChange === 'function') this.app.model.emitChange({ type: 'legend-changed' }); }; addLegendBtn.addEventListener('click', addListener); this._addEventListener(addLegendBtn, 'click', addListener); } }

  _wireSmoothnessControl() { const smoothSlider = document.getElementById('smoothnessSlider'); if (!smoothSlider) return; smoothSlider.min = "0.8"; smoothSlider.max = "0.99"; smoothSlider.step = "0.01"; smoothSlider.value = 0.95; this._clearEventListeners(smoothSlider); const listener = (e) => { const value = parseFloat(e.target.value); this.app.renderer.smoothFactors = { drag: value, zoom: value, general: value }; }; smoothSlider.addEventListener('input', listener); this._addEventListener(smoothSlider, 'input', listener); }

  _updateTitleFromModel() { const titleEl = document.getElementById('title'); if (!titleEl) return; const titleText = this.app?.model?.uiInfo?.title || 'ARCHITECTURE VISUALIZATION'; titleEl.textContent = titleText; }

  updateMobileUI() {
    // dodatkowy warunek: wymagamy wąskiego viewportu, by nie pokazywać UI mobilnego
    const narrowScreen = (typeof window !== 'undefined') ? window.innerWidth <= 900 : false;
    const mobile = !!this.isMobile && narrowScreen;
      // debug log removed
    this.setVisibility('mobileControls', mobile);
    this.setVisibility('mobileMenu', mobile);
    this.setVisibility('leftPanel', !mobile);
    this.setVisibility('rightPanel', !mobile);
    this.setVisibility('title', !mobile);
    this.setVisibility('mobileSaveBtn', mobile);
    this.setVisibility('mobileLoadBtn', mobile);
    this.setVisibility('mobileSampleBtn', mobile);
    try {
      const uiHidden = (typeof document !== 'undefined') ? document.body.classList.contains('hide-ui') : false;
      this.setVisibility('uiToggle', uiHidden, { useHiddenClass: false, setAria: false, className: 'visible' });
    } catch (e) { this.setVisibility('uiToggle', false, { useHiddenClass: false, setAria: false, className: 'visible' }); }
    try {
      if (!this._mobileResizeHooked && typeof window !== 'undefined') {
        this._mobileResizeHooked = true;
        window.addEventListener('resize', () => { const prev = this.isMobile; this.isMobile = this.detectMobile(); if (prev !== this.isMobile) this.updateMobileUI(); });
      }
    } catch (e) {}
  }

}
