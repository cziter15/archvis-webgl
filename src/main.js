// Architecture XML utilities
class ArchitectureXML {
	static architectureToXML(architecture) {
		let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
		xml += '<arch>\n';

		xml += `  <node name="${architecture.root.name}" pos="${architecture.root.pos.join(',')}" color="${architecture.root.color}" scale="${architecture.root.scale}">\n`;

		architecture.root.children.forEach(child => {
			xml += this.nodeToXML(child, 2);
		});

		xml += '  </node>\n';

		if (architecture.legend && architecture.legend.length > 0) {
			xml += '  <legend>\n';
			architecture.legend.forEach(entry => {
				xml += `    <entry name="${entry.name}" color="${entry.color}" />\n`;
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
		xml += `${spaces}<node name="${node.name}" pos="${node.pos.join(',')}" color="${node.color}"`;

		if (node.scale !== undefined) {
			xml += ` scale="${node.scale}"`;
		}

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
			name: rootElement.getAttribute('name'),
			pos: rootElement.getAttribute('pos').split(',').map(Number),
			color: rootElement.getAttribute('color'),
			scale: parseFloat(rootElement.getAttribute('scale')),
			children: []
		};

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
			name: nodeElement.getAttribute('name'),
			pos: nodeElement.getAttribute('pos').split(',').map(Number),
			color: nodeElement.getAttribute('color'),
			children: []
		};

		const scale = nodeElement.getAttribute('scale');
		if (scale) {
			node.scale = parseFloat(scale);
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

function createNode(name, position, color, scale = 1) {
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
	group.userData = { name, rotationSpeed: Math.random() * 0.01 + 0.005, rotatingGroup };

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

function createChildNodes(children, parentNode, parentPos, parentColor) {
	children.forEach(child => {
		if (child.name) {
			const childNode = createNode(child.name, child.pos, child.color, child.scale || 1);
			createLine(parentPos, child.pos, parentColor);

			if (child.children && child.children.length > 0) {
				createChildNodes(child.children, childNode, child.pos, child.color);
			}
		}
	});
}

function rebuildScene() {
	nodes.forEach(node => scene.remove(node));
	lines.forEach(line => scene.remove(line));
	nodes.length = 0;
	lines.length = 0;

	if (architecture.root.name && architecture.root.name !== 'Empty Architecture') {
		const rootNode = createNode(architecture.root.name, architecture.root.pos, architecture.root.color, architecture.root.scale);

		if (architecture.root.children && architecture.root.children.length > 0) {
			createChildNodes(architecture.root.children, rootNode, architecture.root.pos, architecture.root.color);
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

function resetAutoRotate() {
	clearTimeout(inactivityTimer);
	inactivityTimer = setTimeout(() => {
		autoRotate = true;
	}, 3000);
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

	// apply mobile left stick movement
	if (mobile.leftPos) {
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
		line.material.opacity = 0.3 + Math.sin(frame * 0.05 + i) * 0.2;
	});

	particles.rotation.y += 0.0003;
	particles.rotation.x += 0.0001;

	renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});

export { ArchitectureXML }; // export in case other modules need it
