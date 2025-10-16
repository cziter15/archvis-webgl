// Top-level application orchestrator (MainApp)
// Instantiates model, renderer, input and UI and provides cross-component references via `this`.

import UI from './ui.js';
import { ArchRenderer } from './archrenderer.js';
import { initInput, bindRenderer, inputState, keys, mobile } from './input.js';
import { ArchitectureXML } from './serializer.js';
import * as ArchModel from './archmodel.js';

export class MainApp {
  constructor() {
    this.architecture = { root: { name: 'Empty Architecture', pos: [0,0,0], color: '#666666', scale: 1, children: [] }, legend: [], uiInfo: { title: '' } };
    this.editMode = false;
    this.selectedId = null;
    this.selectedNode = null;

    this.renderer = null;
    this.ui = null;
    this.input = null; // module-level functions are used, but keep ref for clarity
  }

  init() {
    // create renderer
    this.renderer = new ArchRenderer({ mountElement: document.getElementById('canvas') });
  // attach back-reference so renderer can access other components via mainApp
  this.renderer.app = this;
    // wire color resolver
    this.renderer.colorResolver = (n) => ArchModel.getColorForArchNode(n, this.architecture.legend);

    // initialize UI with references to methods and state
    UI.init({
      // make UI operate on MainApp's architecture instance so edits reflect immediately in renderer
      getArchitecture: () => this.architecture,
      setArchitecture: (a) => { this.architecture = a; },
      getSelectedId: () => this.renderer.selectedId,
      getSelectedNode: () => this.selectedNode || (this.renderer.selectedId ? this.renderer.getSceneNodeById(this.renderer.selectedId) : null),
      setSelectedId: (id) => { this.renderer.selectedId = id; this.selectedId = id; },
      setSelectedNode: (node) => { this.selectedNode = node; },
      // edit mode is owned by UI now; UI will call setEditMode on itself and notify app via callbacks if needed
      getEditMode: () => UI && UI.getEditMode ? UI.getEditMode() : false,
      setEditMode: (v) => { try { UI.setEditMode && UI.setEditMode(v); } catch(e) {} },
      findNodeById: (root, id) => ArchModel.findNodeById(root, id),
      rebuildScene: () => this.rebuildScene(),
      updateSceneNodeColor: this.renderer.updateSceneNodeColor.bind(this.renderer),
      archRenderer: this.renderer,
      app: this
    });

    // init input and bind renderer (single consolidated binding)
    initInput();
    bindRenderer({ archRenderer: this.renderer, camera: this.renderer.camera, renderer: this.renderer.renderer, getEditMode: () => (UI && UI.getEditMode ? UI.getEditMode() : false), getSelectedNode: () => this.selectedNode, onGizmoMove: (node) => {
      try { UI.updateSelectedIndicatorPosition(); } catch(e) {}
      try { ArchModel.updateNodePositionFromScene(this.architecture.root, node.userData.id, node); } catch(e) {}
    }, onGizmoUp: () => {
      try { if (this.selectedNode) ArchModel.updateNodePositionFromScene(this.architecture.root, this.selectedNode.userData.id, this.selectedNode); } catch(e) {}
    }, onSelect: (id, node) => {
      this.selectedId = id;
      this.selectedNode = node;
  try { if (this.renderer) this.renderer.selectedId = id; } catch(e) {}
  // defensive: ensure edit panel is visible and populated
  try { UI.setEditMode && UI.setEditMode(true); } catch(e) {}
  try { const hdr = document.getElementById('nodeEditorHeader'); if (hdr) hdr.style.display = ''; } catch(e) {}
  try { const panel = document.getElementById('editPanel'); if (panel) { panel.style.display = ''; panel.setAttribute('aria-hidden','false'); } } catch(e) {}
  try { UI.populateEditPanelForSelected(); } catch(e) {}
  try { UI.updateSelectedIndicatorPosition(); } catch(e) {}
    }, onDeselect: () => {
      this.selectedId = null;
      this.selectedNode = null;
      try { if (this.renderer) this.renderer.selectedId = null; } catch(e) {}
      try { UI.populateEditPanelForSelected(); } catch(e) {}
      try { UI.updateSelectedIndicatorPosition(); } catch(e) {}
      try { UI.setEditMode && UI.setEditMode(false); } catch(e) {}
    }});

    // start renderer loop
  this.renderer.startLoop(inputState, keys, mobile, { getSelectedNode: () => this.selectedNode, onPosUpdate: (id, node) => { try { ArchModel.updateNodePositionFromScene(this.architecture.root, id, node); } catch(e) {} }, onUpdateSelectedIndicator: () => { try { UI.updateSelectedIndicatorPosition(); } catch(e) {} }, app: this });

    // load a sample architecture
    try {
      const sampleXML = `<?xml version="1.0" encoding="UTF-8"?>\n<arch>\n  <node name="ROOT" pos="0,0,0" color="#00ffff" scale="1">\n\t<node name="API Gateway" pos="10,5,0" color="#ff00ff" scale="0.8">\n\t  <node name="Auth Service" pos="15,8,5" color="#ffff00" scale="0.6" />\n\t  <node name="Rate Limiter" pos="15,8,-5" color="#ffff00" scale="0.6" />\n\t</node>\n\t<node name="Database Layer" pos="-10,5,0" color="#00ff00" scale="0.8">\n\t  <node name="Primary DB" pos="-15,8,5" color="#ffff00" scale="0.6" />\n\t  <node name="Cache" pos="-15,8,-5" color="#ffff00" scale="0.6" />\n\t</node>\n\t<node name="Workers" pos="0,-5,10" color="#ff6600" scale="0.8">\n\t  <node name="Job Queue" pos="5,-8,15" color="#ffff00" scale="0.6" />\n\t  <node name="Worker Pool" pos="-5,-8,15" color="#ffff00" scale="0.6" />\n\t</node>\n  </node>\n  <legend>\n\t<entry name="Core Services" color="#00ffff" />\n\t<entry name="Modules" color="#ff00ff" />\n\t<entry name="Components" color="#ffff00" />\n\t<entry name="Data Layer" color="#00ff00" />\n  </legend>\n  <ui-info>\n\t<title>MICROSERVICES ARCHITECTURE</title>\n  </ui-info>\n</arch>`;
      const loaded = ArchitectureXML.xmlToArchitecture(sampleXML);
      this.architecture = loaded;
      this.rebuildScene();
  try { UI.updateLeftLegendDisplay(); } catch(e) {}
  try { UI.updateTitle(); } catch(e) {}
  UI.addMessage('Sample loaded');
    } catch (e) { console.warn('Sample load failed', e); }

    // expose for debugging
    window.mainApp = this;
  }

  rebuildScene() {
    const prev = this.selectedId || (this.selectedNode && this.selectedNode.userData ? this.selectedNode.userData.id : null);
    const found = this.renderer.rebuildScene(this.architecture, prev);
    if (found) {
      this.selectedNode = found;
      this.selectedId = found.userData && found.userData.id ? found.userData.id : this.selectedId;
      try { UI.updateSelectedIndicatorPosition(); } catch(e) {}
      try { UI.populateEditPanelForSelected(); } catch(e) {}
    } else {
      this.selectedNode = null;
      this.selectedId = null;
      try { UI.updateSelectedIndicatorPosition(); } catch(e) {}
      try { UI.populateEditPanelForSelected(); } catch(e) {}
    }
  }
}

export default MainApp;
