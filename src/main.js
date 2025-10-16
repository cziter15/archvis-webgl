// Architecture XML utilities
class ArchitectureXML {
	static architectureToXML(architecture) {
		let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
		xml += '<arch>\n';

		// root node: include id and category if present; if category exists, skip explicit color
		const rootAttrs = [];
		rootAttrs.push(`name="${architecture.root.name}"`);
		rootAttrs.push(`pos="${architecture.root.pos.join(',')}"`);
		if (architecture.root.id) rootAttrs.push(`id="${architecture.root.id}"`);
		if (architecture.root.category) {
			rootAttrs.push(`category="${architecture.root.category}"`);
		} else if (architecture.root.color) {
			rootAttrs.push(`color="${architecture.root.color}"`);
		}
		if (architecture.root.scale !== undefined) rootAttrs.push(`scale="${architecture.root.scale}"`);
		xml += `  <node ${rootAttrs.join(' ')}>\n`;

		architecture.root.children.forEach(child => {
			xml += this.nodeToXML(child, 2);
		});

		xml += '  </node>\n';

		if (architecture.legend && architecture.legend.length > 0) {
			xml += '  <legend>\n';
			architecture.legend.forEach(entry => {
				xml += `    <entry id="${entry.id || ''}" name="${entry.name}" color="${entry.color}" />\n`;
			});
			xml += '  </legend>\n';
		}

		if (architecture.uiInfo && architecture.uiInfo.title) {
			xml += '  <ui-info>\n';
			xml += `    <title>${architecture.uiInfo.title}</title>\n`;
			xml += '  </ui-info>\n';
		}

		xml += '</arch>';
		return xml;
	}

	static nodeToXML(node, indent) {
		let xml = '';
		const spaces = ' '.repeat(indent);
		// include id and category when present; if category present, skip color attribute to avoid redundancy
		const attrs = [];
		attrs.push(`name="${node.name}"`);
		attrs.push(`pos="${node.pos.join(',')}"`);
		if (node.id) attrs.push(`id="${node.id}"`);
		if (node.category) {
			attrs.push(`category="${node.category}"`);
		} else if (node.color) {
			attrs.push(`color="${node.color}"`);
		}
		if (node.scale !== undefined) attrs.push(`scale="${node.scale}"`);
		xml += `${spaces}<node ${attrs.join(' ')}`;

		if (node.children && node.children.length > 0) {
			xml += '>\n';
			node.children.forEach(child => {
				xml += this.nodeToXML(child, indent + 2);
			});
			xml += `${spaces}</node>\n`;
		} else {
			xml += ' />\n';
		}

		return xml;
	}

	static xmlToArchitecture(xmlString) {
		const parser = new DOMParser();
		const xmlDoc = parser.parseFromString(xmlString, "text/xml");

		const rootElement = xmlDoc.querySelector('arch > node');
		if (!rootElement) {
			throw new Error('Root element not found in XML');
		}

		const root = {
			id: rootElement.getAttribute('id') || (Math.random().toString(36).slice(2, 9)),
			name: rootElement.getAttribute('name'),
			pos: rootElement.getAttribute('pos').split(',').map(Number),
			children: []
		};
		// category overrides explicit color
		const rootCategory = rootElement.getAttribute('category');
		if (rootCategory) {
			root.category = rootCategory;
		} else {
			const rootColor = rootElement.getAttribute('color');
			if (rootColor) root.color = rootColor;
		}
		const rootScale = rootElement.getAttribute('scale');
		if (rootScale) root.scale = parseFloat(rootScale);

		const childNodes = rootElement.querySelectorAll(':scope > node');
		childNodes.forEach(childElement => {
			const child = this.parseNode(childElement);
			root.children.push(child);
		});

		const legend = [];
		const legendElement = xmlDoc.querySelector('arch > legend');
		if (legendElement) {
			const entryElements = legendElement.querySelectorAll('entry');
			entryElements.forEach(entryElement => {
				const entry = {
					id: entryElement.getAttribute('id') || (Math.random().toString(36).slice(2,9)),
					name: entryElement.getAttribute('name'),
					color: entryElement.getAttribute('color')
				};
				legend.push(entry);
			});
		}

		const uiInfo = { title: '' };
		const uiInfoElement = xmlDoc.querySelector('arch > ui-info');
		if (uiInfoElement) {
			const titleElement = uiInfoElement.querySelector('title');
			if (titleElement) {
				uiInfo.title = titleElement.textContent || '';
			}
		}

		return { root, legend, uiInfo };
	}

	static parseNode(nodeElement) {
		const node = {
			// assign id if present else generate a temporary id
			id: nodeElement.getAttribute('id') || (Math.random().toString(36).slice(2, 9)),
			name: nodeElement.getAttribute('name'),
			pos: nodeElement.getAttribute('pos').split(',').map(Number),
			children: []
		};

		const scale = nodeElement.getAttribute('scale');
		if (scale) {
			node.scale = parseFloat(scale);
		}

		// parse category (legend id) — if present, set category; otherwise read color
		const category = nodeElement.getAttribute('category');
		if (category) {
			node.category = category;
		} else {
			const color = nodeElement.getAttribute('color');
			if (color) node.color = color;
		}

		const childElements = nodeElement.querySelectorAll(':scope > node');
		childElements.forEach(childElement => {
			const child = this.parseNode(childElement);
			node.children.push(child);
		});

		return node;
	}
}

// Global state
let architecture = {
	root: { name: 'Empty Architecture', pos: [0, 0, 0], color: '#666666', scale: 1, children: [] },
	legend: [],
	uiInfo: { title: '' }
};

let uiVisible = true;
let cursorVisible = true;

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

if (!window.smoothFactors) {
	window.smoothFactors = {
		drag: 0.25,
		zoom: 0.15,
		general: 0.12
	};
}

// UI Functions
function addMessage(text) {
	const messageDisplay = document.getElementById('messageDisplay');
	const msg = document.createElement('div');
	msg.className = 'message';
	msg.textContent = text;
	messageDisplay.appendChild(msg);
	setTimeout(() => msg.remove(), 5000);
}

function updateLegend() {
	const legendContainer = document.getElementById('legendContainer');
	const legendItems = document.getElementById('legendItems');

	if (architecture.legend && architecture.legend.length > 0) {
		legendContainer.style.display = 'block';
		legendItems.innerHTML = '';
		architecture.legend.forEach(entry => {
			const div = document.createElement('div');
			div.className = 'legend-entry';
			div.innerHTML = `
						<div class="legend-color" style="background-color: ${entry.color};"></div>
						<span style="color: white;">${entry.name}</span>
					`;
			legendItems.appendChild(div);
		});
	} else {
		legendContainer.style.display = 'none';
	}

	// keep assign select in sync
	renderLegendAssignSelect();
	// also update the right-side legend editor (if present)
	try { renderLegendEditor(); } catch (e) { /* ignore if not available yet */ }
}

// Update only the left-side legend display and assign select, without
// re-rendering the right-side editor. Used to avoid stealing focus from
// editor inputs while typing.
function updateLeftLegendDisplay() {
	const legendItems = document.getElementById('legendItems');
	const legendContainer = document.getElementById('legendContainer');
	if (architecture.legend && architecture.legend.length > 0) {
		if (legendContainer) legendContainer.style.display = 'block';
		if (legendItems) {
			legendItems.innerHTML = '';
			architecture.legend.forEach(entry => {
				const div = document.createElement('div');
				div.className = 'legend-entry';
				div.innerHTML = `
						<div class="legend-color" style="background-color: ${entry.color};"></div>
						<span style="color: white;">${entry.name}</span>
					`;
				legendItems.appendChild(div);
			});
		}
	} else {
		if (legendContainer) legendContainer.style.display = 'none';
	}
	renderLegendAssignSelect();
}

function updateTitle() {
	const title = document.getElementById('title');
	title.textContent = architecture.uiInfo?.title || 'ARCHITECTURE VISUALIZATION';
}

// Event Listeners
document.getElementById('saveBtn').addEventListener('click', () => {
	if (architecture.root.name === 'Empty Architecture' || !architecture.root.name) {
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

document.getElementById('loadBtn').addEventListener('click', () => {
	document.getElementById('xmlFileInput').click();
});

document.getElementById('xmlFileInput').addEventListener('change', (event) => {
	const file = event.target.files[0];
	if (!file) return;

	const reader = new FileReader();
	reader.onload = (e) => {
		try {
			const xmlContent = e.target.result;
			if (!xmlContent || xmlContent.trim() === '') {
				throw new Error('Empty file');
			}

			const loadedArchitecture = ArchitectureXML.xmlToArchitecture(xmlContent);

			if (!loadedArchitecture || !loadedArchitecture.root) {
				throw new Error('Invalid architecture structure');
			}

			architecture = {
				root: loadedArchitecture.root || { name: 'Unknown Root', pos: [0, 0, 0], color: '#ff00ff', scale: 1, children: [] },
				legend: loadedArchitecture.legend || [],
				uiInfo: loadedArchitecture.uiInfo || { title: '' }
			};

			// Map legacy node colors to legend categories when possible
			function mapColorsToLegend(node, legend) {
				if (!node) return;
				if (!node.category && node.color && legend && legend.length) {
					const found = legend.find(e => e.color && e.color.toLowerCase() === node.color.toLowerCase());
					if (found) {
						node.category = found.id;
						delete node.color;
					}
				}
				if (node.children) node.children.forEach(c => mapColorsToLegend(c, legend));
			}

			mapColorsToLegend(architecture.root, architecture.legend);

			// assign stable ids for editing
			assignIdsRecursively(architecture.root);

			updateLegend();
			updateTitle();
			rebuildScene();
			addMessage('Architecture loaded successfully!');
		} catch (error) {
			addMessage('Error loading XML file: ' + error.message);
		}
	};

	reader.readAsText(file);
	event.target.value = '';
});

document.getElementById('sampleBtn').addEventListener('click', () => {
	const sampleXML = `<?xml version="1.0" encoding="UTF-8"?>
<arch>
  <node name="ROOT" pos="0,0,0" color="#00ffff" scale="1">
	<node name="API Gateway" pos="10,5,0" color="#ff00ff" scale="0.8">
	  <node name="Auth Service" pos="15,8,5" color="#ffff00" scale="0.6" />
	  <node name="Rate Limiter" pos="15,8,-5" color="#ffff00" scale="0.6" />
	</node>
	<node name="Database Layer" pos="-10,5,0" color="#00ff00" scale="0.8">
	  <node name="Primary DB" pos="-15,8,5" color="#ffff00" scale="0.6" />
	  <node name="Cache" pos="-15,8,-5" color="#ffff00" scale="0.6" />
	</node>
	<node name="Workers" pos="0,-5,10" color="#ff6600" scale="0.8">
	  <node name="Job Queue" pos="5,-8,15" color="#ffff00" scale="0.6" />
	  <node name="Worker Pool" pos="-5,-8,15" color="#ffff00" scale="0.6" />
	</node>
  </node>
  <legend>
	<entry name="Core Services" color="#00ffff" />
	<entry name="Modules" color="#ff00ff" />
	<entry name="Components" color="#ffff00" />
	<entry name="Data Layer" color="#00ff00" />
  </legend>
  <ui-info>
	<title>MICROSERVICES ARCHITECTURE</title>
  </ui-info>
</arch>`;

	try {
		const loadedArchitecture = ArchitectureXML.xmlToArchitecture(sampleXML);
		architecture = loadedArchitecture;

		// map legacy node colors to legend ids when possible
		function mapColorsToLegend(node, legend) {
			if (!node) return;
			if (!node.category && node.color && legend && legend.length) {
				const found = legend.find(e => e.color && e.color.toLowerCase() === node.color.toLowerCase());
				if (found) {
					node.category = found.id;
					delete node.color;
				}
			}
			if (node.children) node.children.forEach(c => mapColorsToLegend(c, legend));
		}
		mapColorsToLegend(architecture.root, architecture.legend);

		assignIdsRecursively(architecture.root);
		updateLegend();
		updateTitle();
		rebuildScene();
		addMessage('Sample architecture loaded successfully!');
	} catch (error) {
		addMessage('Error loading sample: ' + error.message);
	}
});

// Mobile menu bindings
const mobileSaveBtn = document.getElementById('mobileSaveBtn');
const mobileLoadBtn = document.getElementById('mobileLoadBtn');
const mobileSampleBtn = document.getElementById('mobileSampleBtn');

if (mobileSaveBtn) {
	mobileSaveBtn.addEventListener('click', () => document.getElementById('saveBtn').click());
}
if (mobileLoadBtn) {
	mobileLoadBtn.addEventListener('click', () => document.getElementById('xmlFileInput').click());
}
if (mobileSampleBtn) {
	mobileSampleBtn.addEventListener('click', () => document.getElementById('sampleBtn').click());
}

document.getElementById('smoothnessSlider').addEventListener('change', (e) => {
	const value = parseFloat(e.target.value);
	const invertedValue = 0.55 - value;
	window.smoothFactors = {
		drag: invertedValue,
		zoom: invertedValue * 0.8,
		general: invertedValue * 1.2
	};
	const percentage = Math.round(((0.55 - invertedValue) / 0.45) * 100);
	addMessage(`Smoothness set to ${percentage}%`);
});

document.addEventListener('keydown', (e) => {
	if (e.key.toLowerCase() === 'u') {
		uiVisible = !uiVisible;
		document.getElementById('rightPanel').style.display = uiVisible ? 'block' : 'none';
		document.getElementById('leftPanel').style.display = uiVisible ? 'block' : 'none';
		document.getElementById('uiToggle').classList.toggle('visible', !uiVisible);
	}
	if (e.key.toLowerCase() === 'q') {
		cursorVisible = !cursorVisible;
		document.body.style.cursor = cursorVisible ? 'default' : 'none';
		addMessage(`Cursor ${cursorVisible ? 'visible' : 'hidden'}`);
	}
});

// Three.js Scene
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000510, 0.008);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 50);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000510);
document.getElementById('canvas').appendChild(renderer.domElement);

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

const nodes = [];
const lines = [];

function createTextMesh(text, color) {
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');

	canvas.width = 1024;
	canvas.height = 128;

	context.clearRect(0, 0, canvas.width, canvas.height);
	context.font = '54px Orbitron, sans-serif';
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.shadowColor = color;
	context.shadowBlur = 15;
	context.fillStyle = color;
	context.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;

	const geometry = new THREE.PlaneGeometry(4.5, 0.56);
	const material = new THREE.MeshBasicMaterial({
		map: texture,
		transparent: true,
		side: THREE.DoubleSide,
		depthTest: true
	});

	const textMesh = new THREE.Mesh(geometry, material);

	const backGeometry = new THREE.PlaneGeometry(4.6, 0.66);
	const backMaterial = new THREE.MeshBasicMaterial({
		color: 0x000510,
		transparent: true,
		opacity: 0.8,
		side: THREE.DoubleSide
	});
	const backMesh = new THREE.Mesh(backGeometry, backMaterial);
	backMesh.position.z = -0.05;

	const textGroup = new THREE.Group();
	textGroup.add(backMesh);
	textGroup.add(textMesh);

	const frameGeometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(4.6, 0.66));
	const frameMaterial = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
	const frame = new THREE.LineSegments(frameGeometry, frameMaterial);
	textGroup.add(frame);

	return textGroup;
}

function createNode(name, position, color, scale = 1, id = null) {
	const group = new THREE.Group();
	const rotatingGroup = new THREE.Group();

	const geometry = new THREE.BoxGeometry(0.6 * scale, 0.6 * scale, 0.6 * scale);
	const edges = new THREE.EdgesGeometry(geometry);
	const lineMaterial = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
	const cube = new THREE.LineSegments(edges, lineMaterial);
	rotatingGroup.add(cube);

	const glowGeometry = new THREE.BoxGeometry(0.4 * scale, 0.4 * scale, 0.4 * scale);
	const glowMaterial = new THREE.MeshBasicMaterial({
		color: color,
		transparent: true,
		opacity: 0.3,
		wireframe: true
	});
	const glow = new THREE.Mesh(glowGeometry, glowMaterial);
	rotatingGroup.add(glow);

	const light = new THREE.PointLight(color, 0.5, 5);
	rotatingGroup.add(light);

	group.add(rotatingGroup);

	try {
		const textMesh = createTextMesh(name, color);
		textMesh.position.y = 1.5 * scale;
		group.add(textMesh);
	} catch (error) {
		console.warn('Failed to create text mesh:', error);
	}

	group.position.set(...position);
	// Ensure each node has a unique id for safe mapping back to architecture
	const uid = id || (Math.random().toString(36).slice(2, 9));
	group.userData = { id: uid, name, rotationSpeed: Math.random() * 0.01 + 0.005, rotatingGroup };

	scene.add(group);
	nodes.push(group);

	return group;
}

function createLine(start, end, color, opacity = 0.5) {
	const points = [
		new THREE.Vector3(...start),
		new THREE.Vector3(...end)
	];
	const geometry = new THREE.BufferGeometry().setFromPoints(points);
	const material = new THREE.LineBasicMaterial({
		color: color,
		transparent: true,
		opacity: opacity
	});
	const line = new THREE.Line(geometry, material);
	scene.add(line);
	lines.push(line);
}

// helper to get scene node by id
function getSceneNodeById(id) {
	return nodes.find(n => n.userData && n.userData.id === id) || null;
}

// createLine with optional ids so we can update geometry when nodes move
function createLineWithIds(start, end, color, startId = null, endId = null, opacity = 0.5) {
	const points = [
		new THREE.Vector3(...start),
		new THREE.Vector3(...end)
	];
	const geometry = new THREE.BufferGeometry().setFromPoints(points);
	const material = new THREE.LineBasicMaterial({
		color: color,
		transparent: true,
		opacity: opacity
	});
	const line = new THREE.Line(geometry, material);
	line.userData = { startId, endId };
	scene.add(line);
	lines.push(line);
	return line;
}

function createChildNodes(children, parentNode, parentPos, parentColor) {
	children.forEach(child => {
		if (child.name) {
			const childColor = getColorForArchNode(child);
			const childNode = createNode(child.name, child.pos, childColor, child.scale || 1, child.id || null);
			const parentId = parentNode && parentNode.userData ? parentNode.userData.id : null;
			createLineWithIds(parentPos, child.pos, parentColor, parentId, child.id || null);

			if (child.children && child.children.length > 0) {
				createChildNodes(child.children, childNode, child.pos, childColor);
			}
		}
	});
}

// helper: update visible materials and light for a scene node to a new color (hex string)
function updateSceneNodeColor(sceneNode, colorHex) {
	if (!sceneNode || !colorHex) return;
	try {
		// rotatingGroup is stored in userData
		const rg = sceneNode.userData && sceneNode.userData.rotatingGroup;
		if (rg && rg.children) {
			rg.children.forEach(c => {
				if (c.material && c.material.color) {
					c.material.color.set(colorHex);
				}
				if (c.isPointLight || c.type === 'PointLight') {
					c.color && c.color.set && c.color.set(colorHex);
				}
			});
		}
		// update text/frame materials if present
		sceneNode.children.forEach(child => {
			if (child.type === 'Group') {
				child.children.forEach(ch => {
					if (ch.material && ch.material.color) {
						ch.material.color.set(colorHex);
					}
				});
			}
		});
	} catch (e) {
		console.warn('Failed to update scene node color', e);
	}
}

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

function rebuildScene() {
	// remember selected id to re-link after rebuilding
	const prevSelectedId = selectedNode && selectedNode.userData ? selectedNode.userData.id : null;

	nodes.forEach(node => scene.remove(node));
	lines.forEach(line => scene.remove(line));
	nodes.length = 0;
	lines.length = 0;

	if (architecture.root.name && architecture.root.name !== 'Empty Architecture') {
		// ensure root has id
		if (!architecture.root.id) architecture.root.id = (Math.random().toString(36).slice(2, 9));
		const rootColor = getColorForArchNode(architecture.root);
		const rootNode = createNode(architecture.root.name, architecture.root.pos, rootColor, architecture.root.scale, architecture.root.id);

		if (architecture.root.children && architecture.root.children.length > 0) {
			createChildNodes(architecture.root.children, rootNode, architecture.root.pos, rootColor);
		}
	}

	// re-link selectedNode by id if possible
	if (prevSelectedId) {
		const found = nodes.find(n => n.userData && n.userData.id === prevSelectedId);
		if (found) {
			selectedNode = found;
			if (selectedIndicator) selectedIndicator.style.display = 'block';
			updateSelectedIndicatorPosition();
			populateEditPanelForSelected();
		} else {
			selectedNode = null;
			if (selectedIndicator) selectedIndicator.style.display = 'none';
			populateEditPanelForSelected();
		}
	}
}

// Particles
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 1500;
const positions = new Float32Array(particlesCount * 3);

for (let i = 0; i < particlesCount * 3; i++) {
	positions[i] = (Math.random() - 0.5) * 100;
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const particlesMaterial = new THREE.PointsMaterial({
	size: 0.05,
	color: 0x00ffff,
	transparent: true,
	opacity: 0.6
});
const particles = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particles);

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
let gizmoGroup = null;
let axisDragging = null; // 'x'|'y'|'z' or null
let axisDragStart = null;

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
	if (selectedIndicator) return;
	selectedIndicator = document.createElement('div');
	selectedIndicator.className = 'selected-node-indicator';
	document.body.appendChild(selectedIndicator);
}

function ensureRenameInput() {
	if (renameInput) return;
	renameInput = document.createElement('input');
	renameInput.type = 'text';
	renameInput.style.position = 'absolute';
	renameInput.style.zIndex = 90;
	renameInput.style.display = 'none';
	renameInput.style.padding = '6px 8px';
	renameInput.style.border = '1px solid #00ffff';
	renameInput.style.background = 'rgba(0,0,0,0.8)';
	renameInput.style.color = '#00ffff';
	renameInput.style.fontFamily = 'Orbitron, sans-serif';
	document.body.appendChild(renameInput);
	renameInput.addEventListener('blur', () => {
		if (!selectedNode) return;
		const newName = renameInput.value.trim();
		if (newName && newName !== selectedNode.userData.name) {
			selectedNode.userData.name = newName;
			// regenerate text mesh: for simplicity, rebuild the scene
			updateArchitectureNameForSelected(newName);
			rebuildScene();
		}
		renameInput.style.display = 'none';
	});
}

function createGizmo() {
	if (gizmoGroup) return gizmoGroup;
	gizmoGroup = new THREE.Group();
	const shaftGeom = new THREE.CylinderGeometry(0.06, 0.06, 1, 8);
	const coneGeom = new THREE.ConeGeometry(0.12, 0.2, 8);

	// X axis (red)
	const matX = new THREE.MeshBasicMaterial({ color: 0xff0000 });
	const shaftX = new THREE.Mesh(shaftGeom, matX);
	shaftX.rotation.z = -Math.PI / 2;
	shaftX.position.x = 0.5;
	const coneX = new THREE.Mesh(coneGeom, matX);
	coneX.rotation.z = -Math.PI / 2;
	coneX.position.x = 1.05;
	const groupX = new THREE.Group();
	groupX.add(shaftX);
	groupX.add(coneX);
	groupX.userData = { axis: 'x' };

	// Y axis (green)
	const matY = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
	const shaftY = new THREE.Mesh(shaftGeom, matY);
	shaftY.position.y = 0.5;
	const coneY = new THREE.Mesh(coneGeom, matY);
	coneY.position.y = 1.05;
	const groupY = new THREE.Group();
	groupY.add(shaftY);
	groupY.add(coneY);
	groupY.userData = { axis: 'y' };

	// Z axis (blue)
	const matZ = new THREE.MeshBasicMaterial({ color: 0x0000ff });
	const shaftZ = new THREE.Mesh(shaftGeom, matZ);
	shaftZ.rotation.x = Math.PI / 2;
	shaftZ.position.z = 0.5;
	const coneZ = new THREE.Mesh(coneGeom, matZ);
	coneZ.rotation.x = Math.PI / 2;
	coneZ.position.z = 1.05;
	const groupZ = new THREE.Group();
	groupZ.add(shaftZ);
	groupZ.add(coneZ);
	groupZ.userData = { axis: 'z' };

	gizmoGroup.add(groupX, groupY, groupZ);
	gizmoGroup.visible = false;
	scene.add(gizmoGroup);
	return gizmoGroup;
}

function showGizmoAt(node) {
	if (!node) return;
	createGizmo();
	gizmoGroup.position.copy(node.position);
	gizmoGroup.visible = true;
}

function hideGizmo() {
	if (!gizmoGroup) return;
	gizmoGroup.visible = false;
}

function updateGizmoPosition() {
	if (!gizmoGroup || !selectedNode) return;
	gizmoGroup.position.copy(selectedNode.position);
}

function updateSelectedIndicatorPosition() {
	if (!selectedNode || !selectedIndicator) return;
	const pos = selectedNode.position.clone();
	const projected = pos.project(camera);
	const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
	const y = ( -projected.y * 0.5 + 0.5) * window.innerHeight;
	selectedIndicator.style.left = x + 'px';
	selectedIndicator.style.top = y + 'px';
}

function showRenameInputAtSelected() {
	if (!selectedNode || !renameInput) return;
	const pos = selectedNode.position.clone();
	const projected = pos.project(camera);
	const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
	const y = ( -projected.y * 0.5 + 0.5) * window.innerHeight;
	renameInput.style.left = (x + 24) + 'px';
	renameInput.style.top = (y - 12) + 'px';
	renameInput.value = selectedNode.userData.name || '';
	renameInput.style.display = 'block';
	renameInput.focus();
}

function persistSelectedNodePosition() {
	if (!selectedNode) return;
	// Find the matching node in architecture by id and update pos
	const id = selectedNode.userData && selectedNode.userData.id;
	if (!id) return;
	const archNode = findNodeById(architecture.root, id);
	if (archNode) {
		archNode.pos = [selectedNode.position.x, selectedNode.position.y, selectedNode.position.z];
	} else if (architecture.root && architecture.root.id === id) {
		architecture.root.pos = [selectedNode.position.x, selectedNode.position.y, selectedNode.position.z];
	}
	// persist changes
	rebuildScene();
}

function updateArchitectureNameForSelected(newName) {
	if (!selectedNode) return;
	const oldName = selectedNode.userData.name;
	function searchAndRename(node) {
		if (node.name === oldName) {
			node.name = newName;
			return true;
		}
		if (node.children) {
			for (const c of node.children) {
				if (searchAndRename(c)) return true;
			}
		}
		return false;
	}
	if (architecture.root && architecture.root.name) {
		if (architecture.root.name === oldName) {
			architecture.root.name = newName;
			return;
		}
		searchAndRename(architecture.root);
	}
}

// Helpers to find architecture node by id and keep mapping
function findNodeById(node, id) {
	if (!node) return null;
	if (node.id && node.id === id) return node;
	if (node.children) {
		for (const c of node.children) {
			const found = findNodeById(c, id);
			if (found) return found;
		}
	}
	return null;
}

function assignIdsRecursively(node) {
	if (!node) return;
	if (!node.id) node.id = (Math.random().toString(36).slice(2, 9));
	if (node.children) node.children.forEach(assignIdsRecursively);
}

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
			try { attachImmediateEditHandlers(); } catch (e) {}
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
	renderLegendAssignSelect();
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
	const list = document.getElementById('legendList');
	if (!list) return;
	list.innerHTML = '';
	const legend = architecture.legend || [];
	legend.forEach((entry, idx) => {
		const row = document.createElement('div');
		row.className = 'legend-row';
		if (editMode || editLegendMode) {
			row.innerHTML = `
				<input type="text" class="legend-name" data-idx="${idx}" value="${entry.name}" />
				<div class="legend-swatch" data-idx="${idx}" title="Click to change color" style="width:28px;height:28px;border:1px solid #00ffff;background:${entry.color};box-sizing:border-box;cursor:pointer;"></div>
				<button class="button small legend-remove" data-idx="${idx}">DEL</button>
			`;
		} else {
			// readonly view for regular edit panel
			row.innerHTML = `
				<div style="flex:1;color:#00ffff;">${entry.name}</div>
				<div style="width:12px;height:12px;background:${entry.color};border:1px solid rgba(255,255,255,0.1);"></div>
			`;
		}
		list.appendChild(row);
	});
	// attach handlers when legend is editable (global edit mode or legacy per-legend mode)
	if (editMode || editLegendMode) {
		list.querySelectorAll('.legend-name').forEach(inp => {
			inp.addEventListener('change', (e) => {
				const i = parseInt(e.target.dataset.idx, 10);
				if (!architecture.legend[i]) return;
				architecture.legend[i].name = e.target.value;
				updateLegend();
			});
		});
		// swatch click opens color picker near the swatch
		list.querySelectorAll('.legend-swatch').forEach(swatch => {
			swatch.addEventListener('click', (e) => {
				const i = parseInt(swatch.dataset.idx, 10);
				if (isNaN(i) || !architecture.legend[i]) return;
				const current = architecture.legend[i].color || '#00ffff';
				openColorPickerNear(swatch, current, (val) => {
					architecture.legend[i].color = val;
					updateLegend();
					rebuildScene();
				});
			});
		});
			list.querySelectorAll('.legend-remove').forEach(btn => {
			btn.addEventListener('click', (e) => {
				const i = parseInt(e.target.dataset.idx, 10);
				if (i >= 0 && i < architecture.legend.length) {
					architecture.legend.splice(i, 1);
					updateLegend();
					renderLegendEditor();
					renderLegendAssignSelect();
				}
			});
		});
	}
}

// open a temporary color input positioned near an element to ensure the native picker appears next to it
function openColorPickerNear(anchorEl, initialColor, onPick) {
	try {
		const rect = anchorEl.getBoundingClientRect();
		const input = document.createElement('input');
		input.type = 'color';
		input.value = initialColor || '#00ffff';
		// position exactly over the anchor element so the native picker appears
		// anchored to the swatch. Use same size and location as the swatch.
		input.style.position = 'absolute';
		input.style.left = (rect.left + window.scrollX) + 'px';
		input.style.top = (rect.top + window.scrollY) + 'px';
		input.style.width = (rect.width) + 'px';
		input.style.height = (rect.height) + 'px';
		input.style.zIndex = 100000;
		// Make it nearly invisible but present so it receives pointer events.
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

		const doPick = (val) => {
			try {
				if (onPick) onPick(val);
			} catch (e) { console.warn('onPick handler error', e); }
		};

		input.addEventListener('input', (e) => {
			doPick(e.target.value);
		});
		input.addEventListener('change', (e) => { doPick(e.target.value); cleanup(); });
		input.addEventListener('blur', () => { /* keep cleanup deferred - user may have selected color */ setTimeout(cleanup, 200); });

		const onDocClick = (ev) => {
			if (!input.contains(ev.target)) cleanup();
		};
		document.addEventListener('mousedown', onDocClick, true);

		// Fallback: ensure we don't leave input dangling
		const timeoutId = setTimeout(() => { cleanup(); }, 6000);

		// trigger native picker
		input.click();
	} catch (err) {
		console.warn('color picker fallback', err);
	}
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
		updateLegend();
		renderLegendEditor();
		renderLegendAssignSelect();
		addMessage('Legend added');
	});
}

// wire new legend swatch to open anchored picker
const newLegendSwatch = document.getElementById('newLegendSwatch');
if (newLegendSwatch) {
	newLegendSwatch.addEventListener('click', () => {
		const current = newLegendSwatch.style.backgroundColor || '#00ffff';
		openColorPickerNear(newLegendSwatch, current, (val) => {
			newLegendSwatch.style.backgroundColor = val;
		});
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
			openColorPickerNear(target, current, (val) => {
				architecture.legend[idx].color = val;
				updateLegend();
				rebuildScene();
			});
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
	const sel = document.getElementById('assignLegendSelect');
	if (!sel) return;
	sel.innerHTML = '';
	const blank = document.createElement('option');
	blank.value = '';
	blank.textContent = '-- none --';
	sel.appendChild(blank);
	(architecture.legend || []).forEach((entry) => {
		const opt = document.createElement('option');
		opt.value = entry.id || entry.name;
		opt.textContent = entry.name;
		sel.appendChild(opt);
	});
}

// assign to currently selected node immediately when select changes
const assignLegendSelectEl = document.getElementById('assignLegendSelect');
if (assignLegendSelectEl) {
	assignLegendSelectEl.addEventListener('change', () => {
		if (!selectedNode) return;
		const sel = assignLegendSelectEl;
		const selectedLegendId = sel.value === '' ? '' : sel.value;
		const archNode = findNodeById(architecture.root, selectedNode.userData.id);
		if (!archNode) return;
		if (!selectedLegendId) {
			delete archNode.category;
			// optionally, keep existing color if node had legacy color
		} else {
			archNode.category = selectedLegendId;
			const entry = architecture.legend.find(e => e.id === selectedLegendId);
			if (entry) {
				// apply immediate visual update
				updateSceneNodeColor(selectedNode, entry.color);
			}
		}
		// persist and ensure lines/ids remain correct
		rebuildScene();
		renderLegendAssignSelect();
		populateEditPanelForSelected();
	});
}

// keep select options up to date and ensure legend editor visibility on load
document.addEventListener('DOMContentLoaded', () => {
	renderLegendAssignSelect();
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
	try { renderLegendEditor(); } catch (e) {}
});

// Immediate update handlers for edit panel fields: update model and scene on change
function attachImmediateEditHandlers() {
	const nameIn = document.getElementById('editName');
	const scaleIn = document.getElementById('editScale');
	const posX = document.getElementById('editPosX');
	const posY = document.getElementById('editPosY');
	const posZ = document.getElementById('editPosZ');

	const applyChanges = () => {
		if (!selectedNode) return;
		const newName = nameIn.value.trim();
		const newScale = parseFloat(scaleIn.value) || 1;
		const x = parseFloat(posX.value) || 0;
		const y = parseFloat(posY.value) || 0;
		const z = parseFloat(posZ.value) || 0;

		// update 3D node
		selectedNode.userData.name = newName;
		selectedNode.position.set(x, y, z);

		// update architecture model
		const archNode = findNodeById(architecture.root, selectedNode.userData.id);
		if (archNode) {
			archNode.name = newName;
			archNode.scale = newScale;
			archNode.pos = [x, y, z];
		} else if (architecture.root && architecture.root.name === selectedNode.userData.name) {
			architecture.root.name = newName;
			architecture.root.scale = newScale;
			architecture.root.pos = [x, y, z];
		}

		// minimal immediate feedback: update text label if present
		updateSelectedIndicatorPosition();
		updateGizmoPosition();
		// ensure persistent scene state
		rebuildScene();
	};

	if (nameIn) nameIn.addEventListener('change', applyChanges);
	if (scaleIn) scaleIn.addEventListener('change', applyChanges);
	if (posX) posX.addEventListener('change', applyChanges);
	if (posY) posY.addEventListener('change', applyChanges);
	if (posZ) posZ.addEventListener('change', applyChanges);
}

// attach once
try { attachImmediateEditHandlers(); } catch (e) {}

// Add child to selected node (used from edit panel only)
function addChildAction() {
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

	const parentNode = selectedNode || null;
	const newNode = { id: (Math.random().toString(36).slice(2, 9)), name: 'New Node', pos: parentNode ? [parentNode.position.x + 5, parentNode.position.y, parentNode.position.z] : [architecture.root.pos[0] + 5, architecture.root.pos[1], architecture.root.pos[2]], scale: 0.6, children: [] };

	if (parentNode) {
		const archParent = findNodeById(architecture.root, parentNode.userData.id) || (architecture.root.name === parentNode.userData.name ? architecture.root : null);
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
}

// wire initial button if present
const initialAddChildBtn = document.getElementById('addChildBtn');
if (initialAddChildBtn) initialAddChildBtn.addEventListener('click', addChildAction);

// Delete selected node
function deleteNodeAction() {
	if (!selectedNode) return;
	const id = selectedNode.userData.id;
	// recursive remove function
	function removeById(parent) {
		if (!parent || !parent.children) return false;
		const idx = parent.children.findIndex(c => c.id === id);
		if (idx !== -1) {
			parent.children.splice(idx, 1);
			return true;
		}
		for (const c of parent.children) {
			if (removeById(c)) return true;
		}
		return false;
	}
	if (architecture.root.id === id) {
		addMessage('Cannot delete root node');
		return;
	}
	if (!removeById(architecture.root)) {
		addMessage('Failed to delete node (mapping not found)');
		return;
	}
	selectedNode = null;
	rebuildScene();
	addMessage('Node deleted');
}

// wire initial delete button if present
const initialDeleteBtn = document.getElementById('deleteNodeBtn');
if (initialDeleteBtn) initialDeleteBtn.addEventListener('click', deleteNodeAction);

// Delegated handlers for dynamically-recreated controls inside edit panel
document.addEventListener('click', (e) => {
	const addBtn = e.target.closest && e.target.closest('#addChildBtn');
	if (addBtn) {
		e.preventDefault();
		addChildAction();
		return;
	}
	const delBtn = e.target.closest && e.target.closest('#deleteNodeBtn');
	if (delBtn) {
		e.preventDefault();
		deleteNodeAction();
		return;
	}
});

// Delegated change handler for legend assignment select (handles recreated select)
document.addEventListener('change', (e) => {
	if (!e.target) return;
	if (e.target.id !== 'assignLegendSelect') return;
	if (!selectedNode) return;
	const sel = e.target;
	const selectedLegendId = sel.value === '' ? '' : sel.value;
	const archNode = findNodeById(architecture.root, selectedNode.userData.id);
	if (!archNode) return;
	if (!selectedLegendId) {
		delete archNode.category;
	} else {
		archNode.category = selectedLegendId;
		const entry = architecture.legend.find(e2 => e2.id === selectedLegendId);
		if (entry) updateSceneNodeColor(selectedNode, entry.color);
	}
	rebuildScene();
	renderLegendAssignSelect();
	populateEditPanelForSelected();
});

// Toggle edit mode (desktop only)
// Wire UI handlers safely (guarded to avoid double bindings)
function wireUiHandlers() {
	const attachOnce = (id, event, fn) => {
		const el = document.getElementById(id);
		if (!el) return;
		if (el.dataset && el.dataset.wired) return;
		el.addEventListener(event, fn);
		el.dataset.wired = '1';
	};

	attachOnce('editBtn', 'click', () => {
		if (!isDesktop()) {
			addMessage('Edit mode is available on desktop only.');
			return;
		}
		editMode = !editMode;
		const btn = document.getElementById('editBtn');
		if (btn) {
			btn.classList.toggle('active', editMode);
			// update button label to reflect current state
			btn.textContent = editMode ? '✖️ EXIT EDITOR' : '✏️ EDIT';
		}
		if (editMode) {
			// render legend editor as editable immediately
			renderLegendEditor();
			renderLegendAssignSelect();
			// show node editor header and panel
			const nodeHeader = document.getElementById('nodeEditorHeader');
			if (nodeHeader) nodeHeader.style.display = '';
			const editPanel = document.getElementById('editPanel');
			if (editPanel) { editPanel.style.display = ''; editPanel.setAttribute('aria-hidden', 'false'); }
			ensureSelectedIndicator();
			ensureRenameInput();
			// disable auto-rotate while editing
			autoRotate = false;
			// hide certain UI controls that should not be used while editing
			const toHide = ['saveBtn', 'loadBtn', 'sampleBtn'];
			toHide.forEach(id => {
				const el = document.getElementById(id);
				if (el) {
					el.dataset._wasHiddenByEdit = el.style.display === 'none' ? '1' : '';
					el.style.display = 'none';
				}
			});
			// hide the entire smoothness control (label + min/max + slider)
			const smoothCtrl = document.querySelector('.smoothness-control');
			if (smoothCtrl) {
				smoothCtrl.dataset._wasHiddenByEdit = smoothCtrl.style.display === 'none' ? '1' : '';
				smoothCtrl.style.display = 'none';
			}
			addMessage('Edit mode enabled: use gizmo arrows to move nodes, double-click to rename.');
			// show legend editor only in edit mode
			const legendEditor = document.getElementById('legendEditor');
			if (legendEditor) legendEditor.style.display = '';
			populateEditPanelForSelected();
		} else {
			// hide node editor header and panel
			const nodeHeader = document.getElementById('nodeEditorHeader');
			if (nodeHeader) nodeHeader.style.display = 'none';
			const editPanel = document.getElementById('editPanel');
			if (editPanel) { editPanel.style.display = 'none'; editPanel.setAttribute('aria-hidden', 'true'); }
			if (selectedIndicator) selectedIndicator.style.display = 'none';
			if (renameInput) renameInput.style.display = 'none';
			selectedNode = null;
			hideGizmo();
			populateEditPanelForSelected();
			// schedule auto-rotate to return after inactivity (3s)
			resetAutoRotate();
			// restore previously-hidden controls
			const toShow = ['saveBtn', 'loadBtn', 'sampleBtn'];
			toShow.forEach(id => {
				const el = document.getElementById(id);
				if (el) {
					// if we previously hid it, restore display; otherwise leave as-is
					if (!el.dataset._wasHiddenByEdit) {
						el.style.display = '';
					} else {
						// clean up marker
						delete el.dataset._wasHiddenByEdit;
					}
				}
			});
			// restore smoothness control
			const smoothCtrlRestore = document.querySelector('.smoothness-control');
			if (smoothCtrlRestore) {
				if (!smoothCtrlRestore.dataset._wasHiddenByEdit) {
					smoothCtrlRestore.style.display = '';
				} else {
					delete smoothCtrlRestore.dataset._wasHiddenByEdit;
				}
			}
			addMessage('Edit mode disabled. Auto-rotate will resume after inactivity.');
			// hide legend editor when not editing
			const legendEditor = document.getElementById('legendEditor');
			if (legendEditor) legendEditor.style.display = 'none';
		}
	});

	attachOnce('applyEditBtn', 'click', () => {
		const el = document.getElementById('applyEditBtn');
		if (!el) return;
		// existing handler already attached earlier; noop here
	});

	// addNodeBtn removed from main menu; adding is done from edit panel via addChildBtn
}

// Call wiring immediately and also on DOMContentLoaded as a fallback
try { wireUiHandlers(); } catch (e) { /* ignore */ }
document.addEventListener('DOMContentLoaded', () => { try { wireUiHandlers(); } catch (e) {} });

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
		selectedNode = obj || intersects[0].object.parent;
			if (selectedNode) {
				ensureSelectedIndicator();
				selectedIndicator.style.display = 'block';
				updateSelectedIndicatorPosition();
				populateEditPanelForSelected();
				showGizmoAt(selectedNode);
			}
	} else {
		selectedNode = null;
		if (selectedIndicator) selectedIndicator.style.display = 'none';
		populateEditPanelForSelected();
	}
});

// Utility: compute closest point on axis line (origin + dir * t) to a ray
function closestPointOnAxisToRay(ray, axisOrigin, axisDir) {
	// Solve for t in least squares: minimize |(axisOrigin + axisDir * t) - (ray.origin + ray.direction * s)|
	// Closed form from line-line closest points
	const p1 = axisOrigin.clone();
	const d1 = axisDir.clone().normalize();
	const p2 = ray.origin.clone();
	const d2 = ray.direction.clone().normalize();

	const r = p1.clone().sub(p2);
	const a = d1.dot(d1);
	const b = d1.dot(d2);
	const c = d2.dot(d2);
	const d = d1.dot(r);
	const e = d2.dot(r);

	const denom = a * c - b * b;
	let t = 0;
	if (Math.abs(denom) > 1e-6) {
		t = (b * e - c * d) / denom;
	} else {
		t = 0;
	}
	return p1.add(d1.multiplyScalar(t));
}

// Gizmo interaction: start axis drag when clicking on gizmo
document.addEventListener('mousedown', (e) => {
	if (!editMode) return; // only in edit mode
	if (e.button !== 0) return;
	const rect = renderer.domElement.getBoundingClientRect();
	mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
	mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
	raycaster.setFromCamera(mouse, camera);
	// check gizmo children
	if (gizmoGroup && gizmoGroup.visible) {
		const picks = raycaster.intersectObjects(gizmoGroup.children, true);
		if (picks && picks.length) {
			const picked = picks[0].object;
			// find parent group with userData.axis
			let g = picked;
			while (g && !g.userData.axis) g = g.parent;
			if (g && g.userData && g.userData.axis) {
				axisDragging = g.userData.axis;
				axisDragStart = closestPointOnAxisToRay(raycaster.ray, gizmoGroup.position.clone(), new THREE.Vector3(axisDragging === 'x' ? 1 : 0, axisDragging === 'y' ? 1 : 0, axisDragging === 'z' ? 1 : 0));
				document.body.style.cursor = 'grabbing';
				// prevent camera drag
				isDragging = false;
				isMiddleDragging = false;
				e.preventDefault();
				return;
			}
		}
	}
});

document.addEventListener('mousemove', (e) => {
	if (!editMode) return;
	if (!axisDragging || !selectedNode) return;
	const rect = renderer.domElement.getBoundingClientRect();
	mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
	mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
	raycaster.setFromCamera(mouse, camera);
	const axisDir = new THREE.Vector3(axisDragging === 'x' ? 1 : 0, axisDragging === 'y' ? 1 : 0, axisDragging === 'z' ? 1 : 0);
	const closest = closestPointOnAxisToRay(raycaster.ray, gizmoGroup.position.clone(), axisDir);
	if (closest) {
		selectedNode.position.copy(closest);
		updateSelectedIndicatorPosition();
		updateGizmoPosition();
		// apply immediately to architecture model
		const archNode = findNodeById(architecture.root, selectedNode.userData.id);
		if (archNode) {
			archNode.pos = [selectedNode.position.x, selectedNode.position.y, selectedNode.position.z];
		}
	}
});

document.addEventListener('mouseup', (e) => {
	if (axisDragging) {
		axisDragging = null;
		axisDragStart = null;
		document.body.style.cursor = 'default';
		persistSelectedNodePosition();
	}
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

	nodes.forEach(node => {
		if (node.userData.rotatingGroup) {
			node.userData.rotatingGroup.rotation.y += node.userData.rotationSpeed;
			node.userData.rotatingGroup.rotation.x += node.userData.rotationSpeed * 0.5;
		}
	});

	lines.forEach((line, i) => {
		// animate opacity
		line.material.opacity = 0.3 + Math.sin(frame * 0.05 + i) * 0.2;
		// if line has linked node ids, update geometry to follow nodes
		if (line.userData && (line.userData.startId || line.userData.endId)) {
			const startNode = line.userData.startId ? getSceneNodeById(line.userData.startId) : null;
			const endNode = line.userData.endId ? getSceneNodeById(line.userData.endId) : null;
			if (startNode || endNode) {
				const posAttr = line.geometry.attributes.position;
				const arr = posAttr.array;
				if (startNode) {
					arr[0] = startNode.position.x;
					arr[1] = startNode.position.y;
					arr[2] = startNode.position.z;
				}
				if (endNode) {
					arr[3] = endNode.position.x;
					arr[4] = endNode.position.y;
					arr[5] = endNode.position.z;
				}
				posAttr.needsUpdate = true;
				line.geometry.computeBoundingSphere();
			}
		}
	});

	particles.rotation.y += 0.0003;
	particles.rotation.x += 0.0001;

	// keep UI overlays and gizmo in sync with selected node when camera moves
	if (selectedNode) {
		updateSelectedIndicatorPosition();
		updateGizmoPosition();
		if (renameInput && renameInput.style.display !== 'none') {
			showRenameInputAtSelected();
		}
	}

	renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});

export { ArchitectureXML }; // export in case other modules need it
