import { ArchitectureXML } from './serializer.js';
import { ArchModel, findNodeById, assignIdsRecursively, mapColorsToLegend, renameNodeById, deleteNodeById } from './archmodel.js';
import { ArchRenderer } from './archrenderer.js';
import UI from './ui.js';

// Global state
let architecture = {
	root: { name: 'Empty Architecture', pos: [0, 0, 0], color: '#666666', scale: 1, children: [] },
	legend: [],
	uiInfo: { title: '' }
};

let uiVisible = true;
let cursorVisible = true;
let selectedId = null;

// Simple UI message helper used across the app
function addMessage(text) { try { return UI.addMessage(text); } catch (e) { console.warn('addMessage delegate failed', e); } }

// Try to unregister any previously-registered service workers and optionally clear caches.
// This helps if a deployed service worker or aggressive HTTP caching is serving an old bundle to mobile devices.
// It's intentionally conservative: it only runs when the page loads and logs results to console.
if ('serviceWorker' in navigator) {
	try {
		navigator.serviceWorker.getRegistrations().then(regs => {
			if (regs && regs.length) {
				console.info('Found', regs.length, 'service worker registrations — attempting to unregister them to avoid stale cache.');
			}
			regs.forEach(r => r.unregister().then(ok => {
				console.info('Service worker unregistered:', ok, r);
			}).catch(err => console.warn('SW unregister error', err)));
		}).catch(err => console.warn('Error getting SW registrations', err));

		// Also optionally clear Cache Storage (best-effort). Some hosts may not allow; catch errors.
		if (window.caches && typeof window.caches.keys === 'function') {
			caches.keys().then(names => {
				names.forEach(name => {
					caches.delete(name).then(deleted => {
						console.info('Cache deleted:', name, deleted);
					}).catch(err => console.warn('Cache delete failed', name, err));
				});
			}).catch(err => console.warn('Error listing caches', err));
		}
	} catch (e) {
		console.warn('Service worker cleanup failed', e);
	}
}
// Renderer instance (centralized Three.js ops)
const archRenderer = new ArchRenderer({ mountElement: document.getElementById('canvas') });
// aliases used across this file for backward compatibility
const scene = archRenderer.scene;
const camera = archRenderer.camera;
const renderer = archRenderer.renderer;
const nodes = archRenderer.nodes;
const lines = archRenderer.lines;
renderer.setClearColor(0x000510);
document.getElementById('canvas').appendChild(renderer.domElement);

// Initialize UI module and pass in necessary dependencies
try {
	UI.init({
		getArchitecture: () => architecture,
		setArchitecture: (arch) => { architecture = arch; },
		getSelectedId: () => selectedId,
		getSelectedNode: () => selectedNode || (selectedId ? archRenderer.getSceneNodeById(selectedId) : null),
		setSelectedId: (id) => { selectedId = id; },
		setSelectedNode: (node) => { selectedNode = node; },
		getEditMode: () => editMode,
		setEditMode: (v) => { editMode = v; },
		findNodeById: (root, id) => findNodeById(root, id),
		rebuildScene: () => rebuildScene(),
		updateSceneNodeColor: (sceneNode, color) => updateSceneNodeColor(sceneNode, color),
		archRenderer: archRenderer
	});
} catch (e) { console.warn('UI.init failed', e); }

const ambientLight = new THREE.AmbientLight(0x1a1a3e, 0.8);
scene.add(ambientLight);

const pointLight1 = new THREE.PointLight(0x00ffff, 1.5, 60);
pointLight1.position.set(15, 15, 15);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0xff00ff, 1.5, 60);
pointLight2.position.set(-15, 10, -15);
scene.add(pointLight2);

const pointLight3 = new THREE.PointLight(0xffffff, 1, 40);
pointLight3.position.set(0, 20, 0);
scene.add(pointLight3);

const gridHelper = new THREE.GridHelper(100, 100, 0x00ffff, 0x0a0a2e);
gridHelper.position.y = -18;
scene.add(gridHelper);

// Delegate low-level Three.js operations to archRenderer to keep SRP
function createTextMesh(text, color) { return archRenderer.createTextMesh(text, color); }
function createNode(name, position, color, scale = 1, id = null) { return archRenderer.createNode(name, position, color, scale, id); }
function createLine(start, end, color, opacity = 0.5) { return archRenderer.createLineWithIds(start, end, color, null, null, opacity); }
function createLineWithIds(start, end, color, startId = null, endId = null, opacity = 0.5) { return archRenderer.createLineWithIds(start, end, color, startId, endId, opacity); }
function getSceneNodeById(id) { return archRenderer.getSceneNodeById(id); }
function createChildNodes(children, parentNode, parentPos, parentColor) { return archRenderer.createChildNodes(children, parentNode, parentPos, parentColor, getColorForArchNode); }
function updateSceneNodeColor(sceneNode, colorHex) { return archRenderer.updateSceneNodeColor(sceneNode, colorHex); }

// Resolve color for an architecture node object: prefer category -> legend color, then explicit color, then default
function getColorForArchNode(node) {
	if (!node) return '#666666';
	if (node.category) {
		const found = (architecture.legend || []).find(e => e.id === node.category || e.name === node.category);
		if (found && found.color) return found.color;
	}
	if (node.color) return node.color;
	return '#666666';
}

// Ensure the renderer uses our color resolution logic (so rebuildScene picks up categories)
try {
	if (archRenderer) archRenderer.colorResolver = getColorForArchNode;
} catch (e) {
	console.warn('Failed to set archRenderer.colorResolver', e);
}

// Ensure renderer uses the same color resolution logic when building the scene
try {
    if (archRenderer) archRenderer.colorResolver = getColorForArchNode;
} catch (e) { /* archRenderer may not be ready in rare ordering cases */ }

function rebuildScene() {
	const prevSelectedId = selectedId || (selectedNode && selectedNode.userData ? selectedNode.userData.id : null);
	const found = archRenderer.rebuildScene(architecture, prevSelectedId);
	if (found) {
		selectedNode = found;
		selectedId = found.userData && found.userData.id ? found.userData.id : selectedId;
		if (selectedIndicator) selectedIndicator.style.display = 'block';
		updateSelectedIndicatorPosition();
		populateEditPanelForSelected();
	} else {
		selectedNode = null;
		selectedId = null;
		if (selectedIndicator) selectedIndicator.style.display = 'none';
		populateEditPanelForSelected();
	}
}

// --- Load / Save / Sample handlers (restore UI bindings) ---
document.addEventListener('DOMContentLoaded', () => {
	const saveBtn = document.getElementById('saveBtn');
	const loadBtn = document.getElementById('loadBtn');
	const sampleBtn = document.getElementById('sampleBtn');
	const xmlFileInput = document.getElementById('xmlFileInput');

	if (saveBtn) {
		saveBtn.addEventListener('click', () => {
			if (!architecture.root || architecture.root.name === 'Empty Architecture' || !architecture.root.name) {
				addMessage('No architecture to save. Please load an architecture first.');
				return;
			}
			const xmlContent = ArchitectureXML.architectureToXML(architecture);
			const blob = new Blob([xmlContent], { type: 'application/xml' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'architecture.xml';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			addMessage('Architecture saved successfully!');
		});
	}

	if (loadBtn) {
		loadBtn.addEventListener('click', () => {
			if (xmlFileInput) xmlFileInput.click();
		});
	}

	if (xmlFileInput) {
		xmlFileInput.addEventListener('change', (event) => {
			const file = event.target.files[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const xmlContent = e.target.result;
					if (!xmlContent || xmlContent.trim() === '') throw new Error('Empty file');
					const loadedArchitecture = ArchitectureXML.xmlToArchitecture(xmlContent);
					if (!loadedArchitecture || !loadedArchitecture.root) throw new Error('Invalid architecture structure');

					architecture = {
						root: loadedArchitecture.root || { name: 'Unknown Root', pos: [0,0,0], color: '#ff00ff', scale: 1, children: [] },
						legend: loadedArchitecture.legend || [],
						uiInfo: loadedArchitecture.uiInfo || { title: '' }
					};

					// map legacy node colors to legend categories when possible
					mapColorsToLegend(architecture.root, architecture.legend);
					assignIdsRecursively(architecture.root);
					try { UI.updateLegend(); } catch (e) { console.warn('UI.updateLegend failed', e); }
					try { UI.updateTitle(); } catch (e) { console.warn('UI.updateTitle failed', e); }
					rebuildScene();
					addMessage('Architecture loaded successfully!');
				} catch (err) {
					addMessage('Error loading XML file: ' + err.message);
				}
			};
			reader.readAsText(file);
			event.target.value = '';
		});
	}

	if (sampleBtn) {
		sampleBtn.addEventListener('click', () => {
			const sampleXML = `<?xml version="1.0" encoding="UTF-8"?>\n<arch>\n  <node name="ROOT" pos="0,0,0" color="#00ffff" scale="1">\n\t<node name="API Gateway" pos="10,5,0" color="#ff00ff" scale="0.8">\n\t  <node name="Auth Service" pos="15,8,5" color="#ffff00" scale="0.6" />\n\t  <node name="Rate Limiter" pos="15,8,-5" color="#ffff00" scale="0.6" />\n\t</node>\n\t<node name="Database Layer" pos="-10,5,0" color="#00ff00" scale="0.8">\n\t  <node name="Primary DB" pos="-15,8,5" color="#ffff00" scale="0.6" />\n\t  <node name="Cache" pos="-15,8,-5" color="#ffff00" scale="0.6" />\n\t</node>\n\t<node name="Workers" pos="0,-5,10" color="#ff6600" scale="0.8">\n\t  <node name="Job Queue" pos="5,-8,15" color="#ffff00" scale="0.6" />\n\t  <node name="Worker Pool" pos="-5,-8,15" color="#ffff00" scale="0.6" />\n\t</node>\n  </node>\n  <legend>\n\t<entry name="Core Services" color="#00ffff" />\n\t<entry name="Modules" color="#ff00ff" />\n\t<entry name="Components" color="#ffff00" />\n\t<entry name="Data Layer" color="#00ff00" />\n  </legend>\n  <ui-info>\n\t<title>MICROSERVICES ARCHITECTURE</title>\n  </ui-info>\n</arch>`;
			try {
				const loadedArchitecture = ArchitectureXML.xmlToArchitecture(sampleXML);
				architecture = loadedArchitecture;
                	mapColorsToLegend(architecture.root, architecture.legend);
				assignIdsRecursively(architecture.root);
				try { UI.updateLegend(); } catch (e) { console.warn('UI.updateLegend failed', e); }
				try { UI.updateTitle(); } catch (e) { console.warn('UI.updateTitle failed', e); }
				rebuildScene();
				addMessage('Sample architecture loaded successfully!');
			} catch (err) {
				addMessage('Error loading sample: ' + err.message);
			}
		});
	}

	// Mobile menu bindings (wire to primary buttons)
	const mobileSaveBtn = document.getElementById('mobileSaveBtn');
	const mobileLoadBtn = document.getElementById('mobileLoadBtn');
	const mobileSampleBtn = document.getElementById('mobileSampleBtn');
	if (mobileSaveBtn) mobileSaveBtn.addEventListener('click', () => { if (saveBtn) saveBtn.click(); });
	if (mobileLoadBtn) mobileLoadBtn.addEventListener('click', () => { if (loadBtn) loadBtn.click(); });
	if (mobileSampleBtn) mobileSampleBtn.addEventListener('click', () => { if (sampleBtn) sampleBtn.click(); });
});


// particles are managed by archRenderer (keeps renderer concerns encapsulated)

// Camera Controls
const keys = { w: false, a: false, s: false, d: false, shift: false, space: false };

// Mobile control state
const mobile = {
	leftTouchId: null,
	rightTouchId: null,
	leftStart: null,
	rightStart: null,
	leftPos: { x: 0, y: 0 },
	rightPos: { x: 0, y: 0 },
	maxRadius: 44
};
// mobile action buttons state
mobile.upPressed = false;
mobile.downPressed = false;

let currentOrbitAngle = 0;
let targetOrbitAngle = 0;
let currentOrbitRadius = 50;
let targetOrbitRadius = 50;
let currentOrbitHeight = 15;
let targetOrbitHeight = 15;
let currentX = 0;
let targetX = 0;
let currentY = 0;
let targetY = 0;
let currentZ = 0;
let targetZ = 0;
let isDragging = false;
let isMiddleDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let autoRotate = true;
let inactivityTimer;
let frame = 0;
// Edit mode state
let editMode = false;
let selectedNode = null; // THREE.Group
let selectedIndicator = null; // DOM element to show selection
let renameInput = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
// Gizmo state
// Gizmo is managed by archRenderer (archRenderer.gizmoGroup / gizmoPointer* methods)

function resetAutoRotate() {
	clearTimeout(inactivityTimer);
	const checkAndEnable = () => {
		if (!editMode) {
			autoRotate = true;
		} else {
			// still editing: re-check after 1s
			inactivityTimer = setTimeout(checkAndEnable, 1000);
		}
	};
	inactivityTimer = setTimeout(checkAndEnable, 3000);
}

document.addEventListener('keydown', (e) => {
	const key = e.key.toLowerCase();
	if (key === 'w') keys.w = true;
	if (key === 'a') keys.a = true;
	if (key === 's') keys.s = true;
	if (key === 'd') keys.d = true;
	if (e.key === 'Shift') keys.shift = true;
	if (e.key === ' ') keys.space = true;
	if (e.key === 'Escape' && document.pointerLockElement === document.getElementById('canvas')) {
		document.exitPointerLock();
	}
});

document.addEventListener('keyup', (e) => {
	const key = e.key.toLowerCase();
	if (key === 'w') keys.w = false;
	if (key === 'a') keys.a = false;
	if (key === 's') keys.s = false;
	if (key === 'd') keys.d = false;
	if (e.key === 'Shift') keys.shift = false;
	if (e.key === ' ') keys.space = false;
});

document.addEventListener('mousedown', (event) => {
	// When in edit mode we generally block camera rotation with left mouse button
	// but still allow middle/right button to pan the view.
	if (editMode) {
		if (event.button === 0) {
			// left button: allow camera rotation with LMB even in edit mode
			isDragging = true;
			lastMouseX = event.clientX;
			lastMouseY = event.clientY;
			autoRotate = false;
			// do not return here: gizmo mousedown handler (registered later) may cancel isDragging if axis drag starts
		}
		if (event.button === 1 || event.button === 2) {
			// allow pan with middle/right even while editing
			event.preventDefault();
			isMiddleDragging = true;
			lastMouseX = event.clientX;
			lastMouseY = event.clientY;
			autoRotate = false;
			return;
		}
		return;
	}

	if (event.button === 0) {
		isDragging = true;
		lastMouseX = event.clientX;
		lastMouseY = event.clientY;
		autoRotate = false;
	} else if (event.button === 1 || event.button === 2) {
		event.preventDefault();
		isMiddleDragging = true;
		lastMouseX = event.clientX;
		lastMouseY = event.clientY;
		autoRotate = false;
	}
});

document.addEventListener('mouseup', () => {
	isDragging = false;
	isMiddleDragging = false;
});

// Node dragging state (disabled - use gizmo)
// let draggingNode = false;

function isDesktop() {
	return window.innerWidth >= 900;
}

// Create DOM indicator for selected node
function ensureSelectedIndicator() {
	try { selectedIndicator = UI.ensureSelectedIndicator(); } catch (e) { console.warn('ensureSelectedIndicator delegate failed', e); }
}

function ensureRenameInput() {
	try { renameInput = UI.ensureRenameInput(); } catch (e) { console.warn('ensureRenameInput delegate failed', e); }
}

// Gizmo implementation moved into ArchRenderer (create/show/hide/update)

function updateSelectedIndicatorPosition() {
	try { return UI.updateSelectedIndicatorPosition(); } catch (e) { /* fallback: do nothing */ }
}

function showRenameInputAtSelected() {
	try { return UI.showRenameInputAtSelected(); } catch (e) { /* ignore */ }
}

function persistSelectedNodePosition() {
	const id = selectedId || (selectedNode && selectedNode.userData && selectedNode.userData.id);
	if (!id) return;
	// resolve transient scene node (if needed)
	const sceneNode = selectedNode || archRenderer.getSceneNodeById(id);
	if (!sceneNode) return;
	// Find the matching node in architecture by id and update pos
	const archNode = findNodeById(architecture.root, id);
	if (archNode) {
		archNode.pos = [sceneNode.position.x, sceneNode.position.y, sceneNode.position.z];
	} else if (architecture.root && architecture.root.id === id) {
		architecture.root.pos = [sceneNode.position.x, sceneNode.position.y, sceneNode.position.z];
	}
	// persist changes
	rebuildScene();
}

// renaming is handled by archmodel.renameNodeById (exposed as renameNodeById)

// Helpers to find architecture node by id and keep mapping
// model helpers imported from archmodel.js
// findNodeById, assignIdsRecursively, mapColorsToLegend are imported at the top

// Populate edit panel with selected node data
function populateEditPanelForSelected() {
	const panel = document.getElementById('editPanel');
	if (!panel) return;
	// never show edit panel when not in edit mode
	if (!editMode) {
		panel.style.display = 'none';
		panel.setAttribute('aria-hidden', 'true');
		return;
	}
	const editContent = document.getElementById('editContent');
	// resolve transient scene node from selectedId if needed
	selectedNode = selectedNode || (selectedId ? archRenderer.getSceneNodeById(selectedId) : null);
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
	const archNode = findNodeById(architecture.root, selectedNode.userData.id) || (architecture.root.name === selectedNode.userData.name ? architecture.root : null);
	// fallback: try matching by name
	const nameMatch = !archNode && (architecture.root.name === selectedNode.userData.name ? architecture.root : null);

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
			try { UI.attachImmediateEditHandlers(); } catch (e) { console.warn('UI.attachImmediateEditHandlers failed', e); }
			try { document.getElementById('addChildBtn').addEventListener('click', () => {}); } catch (e) {}
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
	try { UI.renderLegendAssignSelect(); } catch (e) { /* ignore */ }
	const sel = document.getElementById('assignLegendSelect');
	if (sel) {
		// determine current category for this selected node from architecture (category stores legend id)
		const archNodeForCategory = findNodeById(architecture.root, selectedNode.userData.id);
		let current = '';
		if (archNodeForCategory && archNodeForCategory.category) {
			current = archNodeForCategory.category;
		}
		// If current is numeric index (legacy), try to map to legend id
		if (current !== '') {
			const maybeIndex = parseInt(current, 10);
			if (!isNaN(maybeIndex) && architecture.legend && architecture.legend[maybeIndex]) {
				current = architecture.legend[maybeIndex].id;
			} else {
				// ensure the id exists; if not, try to find by name
				const foundById = (architecture.legend || []).find(e => e.id === current);
				if (!foundById) {
					const foundByName = (architecture.legend || []).find(e => e.name === current);
					if (foundByName) current = foundByName.id;
					else current = '';
				}
			}
		}
		sel.value = current || '';
	}
}

// Legend editor helpers
// legend editability follows global editMode; no separate toggle
let editLegendMode = false; // keep for backward compatibility but prefer editMode

function renderLegendEditor() {
	try { return UI.renderLegendEditor(); } catch (e) { console.warn('renderLegendEditor delegate failed', e); }
}

// open a temporary color input positioned near an element to ensure the native picker appears next to it
function openColorPickerNear(anchorEl, initialColor, onPick) {
	try { return UI.openColorPickerNear(anchorEl, initialColor, onPick); } catch (e) { console.warn('openColorPickerNear delegate failed', e); }
}

// Add legend item from editor
const addLegendBtn = document.getElementById('addLegendBtn');
if (addLegendBtn) {
	addLegendBtn.addEventListener('click', () => {
		const nameInp = document.getElementById('newLegendName');
		const swatch = document.getElementById('newLegendSwatch');
		if (!nameInp || !swatch) return;
		const name = nameInp.value.trim();
		// read computed color in hex; swatch.style.backgroundColor may be rgb(), but most browsers accept it when set
		const color = swatch.style.backgroundColor || '#00ffff';
		if (!name) {
			addMessage('Legend name required');
			return;
		}
		if (!architecture.legend) architecture.legend = [];
		const entry = { id: (Math.random().toString(36).slice(2,9)), name, color };
		architecture.legend.push(entry);
		// clear inputs
		nameInp.value = '';
		swatch.style.backgroundColor = '#00ffff';
		try { UI.updateLegend(); } catch (e) { console.warn('UI.updateLegend failed', e); }
		try { UI.renderLegendEditor(); } catch (e) {}
		try { UI.renderLegendAssignSelect(); } catch (e) {}
		addMessage('Legend added');
	});
}

// wire new legend swatch to open anchored picker
const newLegendSwatch = document.getElementById('newLegendSwatch');
if (newLegendSwatch) {
	newLegendSwatch.addEventListener('click', () => {
		const current = newLegendSwatch.style.backgroundColor || '#00ffff';
		try { UI.openColorPickerNear(newLegendSwatch, current, (val) => { newLegendSwatch.style.backgroundColor = val; }); } catch (e) { console.warn('UI.openColorPickerNear failed', e); }
	});
}

// Legend editor is editable by default; render will attach handlers

// legend edit follows global editMode; no per-legend toggle button

// Instead of re-rendering the entire legend editor on every document click (which
// stole focus from inputs), we use delegated event handling on the legend list
// and only re-render when the legend data actually changes (add/remove/color change).

// Delegated handlers: handle name changes, swatch clicks and remove via event delegation
document.addEventListener('DOMContentLoaded', () => {
	const list = document.getElementById('legendList');
	if (!list) return;

	// Clicks inside legend list
	list.addEventListener('click', (ev) => {
		const target = ev.target;
		// swatch clicked
		if (target.classList && target.classList.contains('legend-swatch')) {
			const idx = parseInt(target.dataset.idx, 10);
			if (isNaN(idx) || !architecture.legend[idx]) return;
			const current = architecture.legend[idx].color || '#00ffff';
			try { UI.openColorPickerNear(target, current, (val) => { architecture.legend[idx].color = val; updateLegend(); rebuildScene(); }); } catch (e) { console.warn('UI.openColorPickerNear failed', e); }
			return;
		}

		// remove button clicked
		if (target.classList && target.classList.contains('legend-remove')) {
			const i = parseInt(target.dataset.idx, 10);
			if (!isNaN(i) && i >= 0 && i < architecture.legend.length) {
				architecture.legend.splice(i, 1);
				updateLegend();
				renderLegendAssignSelect();
			}
			return;
		}
	}, true);

	// Input change for legend names (use input event to preserve focus behavior)
	list.addEventListener('input', (ev) => {
		const target = ev.target;
		if (target.classList && target.classList.contains('legend-name')) {
			const i = parseInt(target.dataset.idx, 10);
			if (!isNaN(i) && architecture.legend[i]) {
				architecture.legend[i].name = target.value;
				// reflect immediately in left-side UI and select, but don't re-render
				// the editor itself to avoid losing input focus.
				updateLeftLegendDisplay();
			}
		}
	}, true);
});

// Legend editing is handled via the always-visible legend editor; no separate toggle in node panel.

// Render select used to assign legend category to a node
function renderLegendAssignSelect() {
	try { return UI.renderLegendAssignSelect(); } catch (e) { console.warn('renderLegendAssignSelect delegate failed', e); }
}

// Update the compact left-side legend display (used in the left panel)
function updateLeftLegendDisplay() {
	try { return UI.updateLeftLegendDisplay(); } catch (e) { console.warn('updateLeftLegendDisplay delegate failed', e); }
}

// Synchronize legend data across UI: left panel, editor and select inputs
function updateLegend() {
	try { return UI.updateLegend(); } catch (e) { console.warn('updateLegend delegate failed', e); }
}

// Update page title and header based on architecture.uiInfo
function updateTitle() {
	try { return UI.updateTitle(); } catch (e) { console.warn('updateTitle delegate failed', e); }
}

// Note: change handler for #assignLegendSelect is attached inside renderLegendAssignSelect()

// keep select options up to date and ensure legend editor visibility on load
document.addEventListener('DOMContentLoaded', () => {
	try { UI.renderLegendAssignSelect(); } catch (e) {}
	const legendEditor = document.getElementById('legendEditor');
 	if (legendEditor) {
 		legendEditor.style.display = editMode ? '' : 'none';
 	}
 	const editPanel = document.getElementById('editPanel');
 	if (editPanel) {
 		editPanel.style.display = editMode ? '' : 'none';
 		editPanel.setAttribute('aria-hidden', editMode ? 'false' : 'true');
 	}
		// ensure node editor header visibility matches edit mode on load
		const nodeHeader = document.getElementById('nodeEditorHeader');
		if (nodeHeader) nodeHeader.style.display = editMode ? '' : 'none';
	// render legend editor UI (editable by default)
	try { UI.renderLegendEditor(); } catch (e) {}
});

// Immediate update handlers for edit panel fields: update model and scene on change
function attachImmediateEditHandlers() {
	try { return UI.attachImmediateEditHandlers(); } catch (e) { console.warn('attachImmediateEditHandlers delegate failed', e); }
}

// attach once
try { UI.attachImmediateEditHandlers(); } catch (e) {}

// Add child to selected node (used from edit panel only)
document.getElementById('addChildBtn').addEventListener('click', () => {
	if (!editMode) {
		addMessage('Enter Edit mode to add nodes.');
		return;
	}

	// If no root exists, create root
	if (!architecture.root || !architecture.root.name || architecture.root.name === 'Empty Architecture') {
		architecture.root = { id: (Math.random().toString(36).slice(2, 9)), name: 'ROOT', pos: [0, 0, 0], color: '#00ffff', scale: 1, children: [] };
		assignIdsRecursively(architecture.root);
		rebuildScene();
		addMessage('Root node created');
		return;
	}

		const parentSceneNode = selectedNode || (selectedId ? archRenderer.getSceneNodeById(selectedId) : null);
		const newNode = { id: (Math.random().toString(36).slice(2, 9)), name: 'New Node', pos: parentSceneNode ? [parentSceneNode.position.x + 5, parentSceneNode.position.y, parentSceneNode.position.z] : [architecture.root.pos[0] + 5, architecture.root.pos[1], architecture.root.pos[2]], scale: 0.6, children: [] };

		if (parentSceneNode) {
			const archParent = findNodeById(architecture.root, parentSceneNode.userData.id) || (architecture.root.name === parentSceneNode.userData.name ? architecture.root : null);
			if (archParent) {
				if (!archParent.children) archParent.children = [];
				archParent.children.push(newNode);
			} else {
				if (!architecture.root.children) architecture.root.children = [];
				architecture.root.children.push(newNode);
			}
		} else {
			// no selected node -- append to root
			if (!architecture.root.children) architecture.root.children = [];
			architecture.root.children.push(newNode);
		}

	rebuildScene();
	addMessage('Child node added');
});

// Delete selected node
document.getElementById('deleteNodeBtn').addEventListener('click', () => {
	if (!selectedNode) return;
	const id = selectedNode.userData.id;
	if (architecture.root.id === id) {
		addMessage('Cannot delete root node');
		return;
	}
	if (!deleteNodeById(architecture.root, id)) {
		addMessage('Failed to delete node (mapping not found)');
		return;
	}
	selectedNode = null;
	rebuildScene();
	addMessage('Node deleted');
});

// Toggle edit mode (desktop only)
// Wire UI handlers safely (guarded to avoid double bindings)
function wireUiHandlers() {
	try { return UI.wireUiHandlers(); } catch (e) { console.warn('wireUiHandlers delegate failed', e); }
}

// Call wiring immediately and also on DOMContentLoaded as a fallback
try { UI.wireUiHandlers(); } catch (e) { /* ignore */ }
document.addEventListener('DOMContentLoaded', () => { try { UI.wireUiHandlers(); } catch (e) {} });

// Selection via click
document.addEventListener('click', (e) => {
	if (!editMode) return;
	// Ignore clicks on UI controls
	if (e.target.closest('.ui-container') || e.target.closest('.panel-box') || e.target.closest('.button')) return;
	// perform raycast
	const rect = renderer.domElement.getBoundingClientRect();
	mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
	mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
	raycaster.setFromCamera(mouse, camera);
	const intersects = raycaster.intersectObjects(nodes, true);
	console.log('edit click', { mx: mouse.x.toFixed(2), my: mouse.y.toFixed(2), rectWidth: rect.width, rectHeight: rect.height, intersectsCount: intersects.length });
	if (intersects && intersects.length) {
		// Find top-level group for the intersected object
		let obj = intersects[0].object;
		while (obj && !nodes.includes(obj)) {
			obj = obj.parent;
		}
		const resolved = obj || intersects[0].object.parent;
		if (resolved) {
			// set canonical selected id and resolve transient scene node
			selectedId = resolved.userData && resolved.userData.id ? resolved.userData.id : null;
			selectedNode = archRenderer.getSceneNodeById(selectedId);
			if (selectedNode) {
				ensureSelectedIndicator();
				selectedIndicator.style.display = 'block';
				updateSelectedIndicatorPosition();
				populateEditPanelForSelected();
				try { archRenderer.showGizmoAt(selectedNode); } catch (e) {}
			}
		}
	} else {
		selectedNode = null;
		selectedId = null;
		if (selectedIndicator) selectedIndicator.style.display = 'none';
		populateEditPanelForSelected();
	}
});

// gizmo closest point helper moved into ArchRenderer

// Gizmo interaction: start axis drag when clicking on gizmo
document.addEventListener('mousedown', (e) => {
	if (!editMode) return; // only in edit mode
	if (e.button !== 0) return;
	const rect = renderer.domElement.getBoundingClientRect();
	mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
	mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
	raycaster.setFromCamera(mouse, camera);
	// delegate gizmo hit testing to renderer
	try {
		const axis = archRenderer.gizmoPointerDown(raycaster);
		if (axis) {
			document.body.style.cursor = 'grabbing';
			// prevent camera drag
			isDragging = false;
			isMiddleDragging = false;
			e.preventDefault();
			return;
		}
	} catch (err) { /* ignore */ }
});

document.addEventListener('mousemove', (e) => {
	if (!editMode) return;
	// delegate move handling to renderer when a gizmo drag is active
	try {
		const rect = renderer.domElement.getBoundingClientRect();
		mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
		mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.setFromCamera(mouse, camera);
		const closest = archRenderer.gizmoPointerMove(raycaster, selectedNode);
		if (closest) {
			updateSelectedIndicatorPosition();
			// apply immediately to architecture model
			const archNode = findNodeById(architecture.root, selectedNode.userData.id);
			if (archNode) archNode.pos = [selectedNode.position.x, selectedNode.position.y, selectedNode.position.z];
		}
	} catch (err) { /* ignore */ }
});

document.addEventListener('mouseup', (e) => {
	// delegate gizmo pointer up
	try { archRenderer.gizmoPointerUp(); } catch (err) {}
	document.body.style.cursor = 'default';
	persistSelectedNodePosition();
});

// Double click to rename
document.addEventListener('dblclick', (e) => {
	if (!editMode || !selectedNode) return;
	showRenameInputAtSelected();
});
// Direct node dragging disabled: use gizmo arrows to move nodes

// Touch handlers for mobile controls
const leftStick = document.getElementById('leftStick');
const rightStick = document.getElementById('rightStick');
const leftKnob = leftStick && leftStick.querySelector('.stick-knob');
const rightKnob = rightStick && rightStick.querySelector('.stick-knob');

function setKnob(knob, dx, dy) {
	if (!knob) return;
	knob.style.transform = `translate(${dx}px, ${dy}px)`;
}

function resetKnob(knob) {
	if (!knob) return;
	knob.style.transition = 'transform 150ms ease-out';
	knob.style.transform = 'translate(0, 0)';
	setTimeout(() => knob.style.transition = '', 160);
}

function handleTouchStart(e) {
	resetAutoRotate();
	for (const t of Array.from(e.changedTouches)) {
		const target = document.elementFromPoint(t.clientX, t.clientY);
		// left stick area
		if (leftStick && (target === leftStick || leftStick.contains(target))) {
			mobile.leftTouchId = t.identifier;
			mobile.leftStart = { x: t.clientX, y: t.clientY };
			mobile.leftPos = { x: 0, y: 0 };
		}
		// right stick area
		else if (rightStick && (target === rightStick || rightStick.contains(target))) {
			mobile.rightTouchId = t.identifier;
			mobile.rightStart = { x: t.clientX, y: t.clientY };
			mobile.rightPos = { x: 0, y: 0 };
		}
	}
}

function handleTouchMove(e) {
	for (const t of Array.from(e.changedTouches)) {
		if (t.identifier === mobile.leftTouchId) {
			const dx = t.clientX - mobile.leftStart.x;
			const dy = t.clientY - mobile.leftStart.y;
			const len = Math.hypot(dx, dy) || 1;
			const nx = (dx / len) * Math.min(len, mobile.maxRadius);
			const ny = (dy / len) * Math.min(len, mobile.maxRadius);
			mobile.leftPos = { x: nx, y: ny };
			setKnob(leftKnob, nx, ny);
		} else if (t.identifier === mobile.rightTouchId) {
			const dx = t.clientX - mobile.rightStart.x;
			const dy = t.clientY - mobile.rightStart.y;
			// map right stick to orbit/height
			targetOrbitAngle -= dx * 0.008;
			targetOrbitHeight += dy * 0.12;
			targetOrbitHeight = Math.max(-20, Math.min(35, targetOrbitHeight));
			mobile.rightStart = { x: t.clientX, y: t.clientY };
			setKnob(rightKnob, dx * 0.6, dy * 0.6);
		}
	}
}

function handleTouchEnd(e) {
	for (const t of Array.from(e.changedTouches)) {
		if (t.identifier === mobile.leftTouchId) {
			mobile.leftTouchId = null;
			mobile.leftStart = null;
			mobile.leftPos = { x: 0, y: 0 };
			resetKnob(leftKnob);
		}
		if (t.identifier === mobile.rightTouchId) {
			mobile.rightTouchId = null;
			mobile.rightStart = null;
			resetKnob(rightKnob);
		}
	}
}

// Pinch zoom support
let pinchStartDist = null;
function getDist(t1, t2) {
	const dx = t1.clientX - t2.clientX;
	const dy = t1.clientY - t2.clientY;
	return Math.hypot(dx, dy);
}

function handleTouchMovePinch(e) {
	if (e.touches.length === 2) {
		const d = getDist(e.touches[0], e.touches[1]);
		if (pinchStartDist == null) pinchStartDist = d;
		const delta = d - pinchStartDist;
		targetOrbitRadius -= delta * 0.03;
		targetOrbitRadius = Math.max(15, Math.min(100, targetOrbitRadius));
		pinchStartDist = d;
	}
}

function handleTouchEndPinch(e) {
	if (e.touches.length < 2) pinchStartDist = null;
}

leftStick && leftStick.addEventListener('touchstart', handleTouchStart, { passive: true });
leftStick && leftStick.addEventListener('touchmove', handleTouchMove, { passive: false });
leftStick && leftStick.addEventListener('touchend', handleTouchEnd, { passive: true });

rightStick && rightStick.addEventListener('touchstart', handleTouchStart, { passive: true });
rightStick && rightStick.addEventListener('touchmove', handleTouchMove, { passive: false });
rightStick && rightStick.addEventListener('touchend', handleTouchEnd, { passive: true });

document.addEventListener('touchstart', (e) => {
	// global handling to detect pinch and general touches
	if (e.touches.length === 2) {
		pinchStartDist = getDist(e.touches[0], e.touches[1]);
	}
	resetAutoRotate();
}, { passive: true });

document.addEventListener('touchmove', (e) => {
	if (e.touches.length === 2) {
		handleTouchMovePinch(e);
	}
	// prevent page scroll when touching canvas area
	if (e.touches.length >= 1) e.preventDefault();
}, { passive: false });

document.addEventListener('touchend', (e) => {
	handleTouchEnd(e);
	handleTouchEndPinch(e);
}, { passive: true });

// Wire up action buttons (up/down)
const btnUp = document.getElementById('btnUp');
const btnDown = document.getElementById('btnDown');
function setButtonActive(el, active) {
	if (!el) return;
	el.classList.toggle('active', active);
}

if (btnUp) {
	btnUp.addEventListener('touchstart', (e) => { e.preventDefault(); mobile.upPressed = true; setButtonActive(btnUp, true); }, { passive: false });
	btnUp.addEventListener('touchend', (e) => { e.preventDefault(); mobile.upPressed = false; setButtonActive(btnUp, false); }, { passive: true });
	btnUp.addEventListener('mousedown', () => { mobile.upPressed = true; setButtonActive(btnUp, true); });
	btnUp.addEventListener('mouseup', () => { mobile.upPressed = false; setButtonActive(btnUp, false); });
}
if (btnDown) {
	btnDown.addEventListener('touchstart', (e) => { e.preventDefault(); mobile.downPressed = true; setButtonActive(btnDown, true); }, { passive: false });
	btnDown.addEventListener('touchend', (e) => { e.preventDefault(); mobile.downPressed = false; setButtonActive(btnDown, false); }, { passive: true });
	btnDown.addEventListener('mousedown', () => { mobile.downPressed = true; setButtonActive(btnDown, true); });
	btnDown.addEventListener('mouseup', () => { mobile.downPressed = false; setButtonActive(btnDown, false); });
}

// Movement update from left virtual stick processed inside animate loop

document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('mousemove', (event) => {
	if (isDragging) {
		const deltaX = event.clientX - lastMouseX;
		const deltaY = event.clientY - lastMouseY;

		targetOrbitAngle -= deltaX * 0.008;
		targetOrbitHeight += deltaY * 0.15;
		targetOrbitHeight = Math.max(-20, Math.min(35, targetOrbitHeight));

		lastMouseX = event.clientX;
		lastMouseY = event.clientY;
	} else if (isMiddleDragging) {
		const deltaX = event.clientX - lastMouseX;
		const deltaY = event.clientY - lastMouseY;

		const right = new THREE.Vector3(
			Math.cos(currentOrbitAngle),
			0,
			-Math.sin(currentOrbitAngle)
		);

		const panSpeed = 0.08;
		targetX += right.x * deltaX * panSpeed;
		targetZ += right.z * deltaX * panSpeed;
		targetY -= deltaY * panSpeed;

		lastMouseX = event.clientX;
		lastMouseY = event.clientY;
	}
});

document.addEventListener('wheel', (event) => {
	// disable wheel zoom while editing so user can precisely position nodes
	if (editMode) return;
	event.preventDefault();
	const zoomDelta = event.deltaY * 0.03;
	targetOrbitRadius += zoomDelta;
	targetOrbitRadius = Math.max(15, Math.min(100, targetOrbitRadius));
}, { passive: false });

function animate() {
	requestAnimationFrame(animate);
	frame++;

	if (autoRotate) {
		targetOrbitAngle += 0.001;
	}

	if (isDragging || isMiddleDragging) {
		resetAutoRotate();
	}

	const smoothFactors = window.smoothFactors || {
		drag: 0.25,
		zoom: 0.15,
		general: 0.12
	};

	currentOrbitAngle += (targetOrbitAngle - currentOrbitAngle) * smoothFactors.drag;
	currentOrbitRadius += (targetOrbitRadius - currentOrbitRadius) * smoothFactors.zoom;
	currentOrbitHeight += (targetOrbitHeight - currentOrbitHeight) * smoothFactors.drag;
	currentX += (targetX - currentX) * smoothFactors.general;
	currentY += (targetY - currentY) * smoothFactors.general;
	currentZ += (targetZ - currentZ) * smoothFactors.general;

	const forward = new THREE.Vector3(
		-Math.sin(currentOrbitAngle),
		0,
		-Math.cos(currentOrbitAngle)
	);
	const right = new THREE.Vector3(
		Math.cos(currentOrbitAngle),
		0,
		-Math.sin(currentOrbitAngle)
	);

	const moveSpeed = 0.3;

	// apply mobile left stick movement (disabled while editing)
	if (!editMode && mobile.leftPos) {
		// normalized values - y is screen down so invert for forward
		const nx = mobile.leftPos.x / mobile.maxRadius; // strafe
		const ny = -mobile.leftPos.y / mobile.maxRadius; // forward/back
		if (Math.abs(nx) > 0.12) {
			targetX += right.x * nx * moveSpeed * 0.8;
			targetZ += right.z * nx * moveSpeed * 0.8;
		}
		if (Math.abs(ny) > 0.12) {
			targetX += forward.x * ny * moveSpeed * 0.8;
			targetZ += forward.z * ny * moveSpeed * 0.8;
		}
	}

	// keyboard-controlled camera movement (WASD/space/shift) - allow even while editing
	if (keys.w) {
		targetX += forward.x * moveSpeed;
		targetZ += forward.z * moveSpeed;
	}
	if (keys.s) {
		targetX -= forward.x * moveSpeed;
		targetZ -= forward.z * moveSpeed;
	}
	if (keys.a) {
		targetX -= right.x * moveSpeed;
		targetZ -= right.z * moveSpeed;
	}
	if (keys.d) {
		targetX += right.x * moveSpeed;
		targetZ += right.z * moveSpeed;
	}
	if (keys.space) {
		targetY += moveSpeed;
	}
	if (keys.shift) {
		targetY -= moveSpeed;
	}

	// mobile up/down buttons
	if (mobile.upPressed) {
		targetY += moveSpeed * 0.9;
	}
	if (mobile.downPressed) {
		targetY -= moveSpeed * 0.9;
	}

	camera.position.x = currentX + Math.sin(currentOrbitAngle) * currentOrbitRadius;
	camera.position.z = currentZ + Math.cos(currentOrbitAngle) * currentOrbitRadius;
	camera.position.y = currentY + currentOrbitHeight;
	camera.lookAt(currentX, currentY, currentZ);

	// delegate node/line/particle updates to renderer
	archRenderer.update(frame);

	// keep UI overlays and gizmo in sync with selected node when camera moves
	if (selectedNode) {
		updateSelectedIndicatorPosition();
		try { archRenderer.updateGizmoPosition(selectedNode); } catch (e) {}
		if (renameInput && renameInput.style.display !== 'none') {
			showRenameInputAtSelected();
		}
	}

	archRenderer.render();
}

animate();

window.addEventListener('resize', () => {
	archRenderer.resize(window.innerWidth, window.innerHeight);
});
