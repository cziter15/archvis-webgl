/*
 *	Copyright (c) 2025-2026, Krzysztof Strehlau
 *
 *	This file is a part of the ArchVis WebGL utility.
 *	All licensing information can be found inside LICENSE.md file.
 *
 *	https://github.com/cziter15/archvis-webgl/blob/main/LICENSE
 */

import * as THREE from 'three';
import { ArchModel } from './model.js';

export class ArchRenderer {
  constructor(app, canvas) {
	this.app = app;
	this.scene = new THREE.Scene();
	this.scene.fog = new THREE.FogExp2(0x000510, 0.008);

	this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
	this.camera.position.set(0, 15, 50);
	this.camera.lookAt(0, 0, 0);

	this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
	this.renderer.setSize(window.innerWidth, window.innerHeight);
	this.renderer.setClearColor(0x000510);
	canvas.appendChild(this.renderer.domElement);

	this._setupLighting();
	this._setupParticles();
	this._setupGizmo();

	this.nodes = [];
	this.lines = [];
	this.selectedId = null;
	this.axisDragging = null;
	
	this.smoothFactors = { drag: 0.95, zoom: 0.95, general: 0.95 };
	this.textCache = new Map();
  }

  _setupLighting() {
	this.scene.add(new THREE.AmbientLight(0x1a1a3e, 0.8));
	
	const lights = [
	  { color: 0x00ffff, intensity: 1.5, distance: 60, position: [15, 15, 15] },
	  { color: 0xff00ff, intensity: 1.5, distance: 60, position: [-15, 10, -15] },
	  { color: 0xffffff, intensity: 1, distance: 40, position: [0, 20, 0] }
	];
	
	lights.forEach(config => {
	  const light = new THREE.PointLight(config.color, config.intensity, config.distance);
	  light.position.set(...config.position);
	  this.scene.add(light);
	});

	const grid = new THREE.GridHelper(100, 100, 0x00ffff, 0x0a0a2e);
	grid.position.y = -18;
	this.scene.add(grid);
  }

  _setupParticles() {
	const geo = new THREE.BufferGeometry();
	const positions = new Float32Array(4500);
	for (let i = 0; i < 4500; i++) positions[i] = (Math.random() - 0.5) * 100;
	geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	
	const mat = new THREE.PointsMaterial({ size: 0.05, color: 0x00ffff, transparent: true, opacity: 0.6 });
	this.particles = new THREE.Points(geo, mat);
	this.scene.add(this.particles);
  }

  _setupGizmo() {
	this.gizmoGroup = new THREE.Group();
	this.gizmoGroup.visible = false;

	const shaftGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 8);
	const coneGeo = new THREE.ConeGeometry(0.12, 0.2, 8);

	const axes = [
	  { axis: 'x', color: 0xff0000, rot: [0, 0, -Math.PI / 2] },
	  { axis: 'y', color: 0x00ff00, rot: [0, 0, 0] },
	  { axis: 'z', color: 0x0000ff, rot: [Math.PI / 2, 0, 0] }
	];

	axes.forEach(({ axis, color, rot }) => {
	  const mat = new THREE.MeshBasicMaterial({ color });
	  const shaft = new THREE.Mesh(shaftGeo, mat);
	  shaft.rotation.set(...rot);
	  shaft.position[axis] = 0.5;

	  const cone = new THREE.Mesh(coneGeo, mat);
	  cone.rotation.set(...rot);
	  cone.position[axis] = 1.05;

	  const group = new THREE.Group();
	  group.add(shaft, cone);
	  group.userData = { axis };
	  this.gizmoGroup.add(group);
	});

	this.scene.add(this.gizmoGroup);
  }

  _createTextMesh(text, color) {
	const cacheKey = `${text}_${color}`;
	if (this.textCache.has(cacheKey)) {
	  return this.textCache.get(cacheKey).clone();
	}

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	canvas.width = 1024;
	canvas.height = 128;

	ctx.font = '54px Orbitron, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.shadowColor = color;
	ctx.shadowBlur = 15;
	ctx.fillStyle = color;
	ctx.fillText(text.toUpperCase(), 512, 64);

	const texture = new THREE.CanvasTexture(canvas);
	const geo = new THREE.PlaneGeometry(4.5, 0.56);
	const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
	const text3d = new THREE.Mesh(geo, mat);

	const backGeo = new THREE.PlaneGeometry(4.6, 0.66);
	const backMat = new THREE.MeshBasicMaterial({ color: 0x000510, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
	const back = new THREE.Mesh(backGeo, backMat);
	back.position.z = -0.05;

	const frame = new THREE.LineSegments(
	  new THREE.EdgesGeometry(new THREE.PlaneGeometry(4.6, 0.66)),
	  new THREE.LineBasicMaterial({ color, linewidth: 2 })
	);

	const group = new THREE.Group();
	group.add(back, text3d, frame);
	this.textCache.set(cacheKey, group);
	return group.clone();
  }

  createNode(node) {
	const group = new THREE.Group();
	const rotatingGroup = new THREE.Group();

	const color = ArchModel.getColor(node, this.app.model.legend);
	const scale = node.scale || 1;

	const geo = new THREE.BoxGeometry(0.6 * scale, 0.6 * scale, 0.6 * scale);
	const edges = new THREE.EdgesGeometry(geo);
	const lineMat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
	rotatingGroup.add(new THREE.LineSegments(edges, lineMat));

	const glowGeo = new THREE.BoxGeometry(0.4 * scale, 0.4 * scale, 0.4 * scale);
	const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, wireframe: true });
	rotatingGroup.add(new THREE.Mesh(glowGeo, glowMat));

	const light = new THREE.PointLight(color, 0.5, 5);
	rotatingGroup.add(light);

	group.add(rotatingGroup);

	const text = this._createTextMesh(node.name, color);
	text.position.y = 1.5 * scale;
	group.add(text);

	group.position.set(...node.pos);
	group.userData = {
	  id: node.id,
	  name: node.name,
	  rotationSpeed: Math.random() * 0.01 + 0.005,
	  rotatingGroup
	};

	this.scene.add(group);
	this.nodes.push(group);
	return group;
  }

  createLine(startPos, endPos, startId, endId, color) {
	const geo = new THREE.BufferGeometry();
	geo.setFromPoints([new THREE.Vector3(...startPos), new THREE.Vector3(...endPos)]);
	const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 });
	const line = new THREE.Line(geo, mat);
	line.userData = { startId, endId };
	this.scene.add(line);
	this.lines.push(line);
	return line;
  }

  getNodeById(id) {
	return this.nodes.find(n => n.userData?.id === id) || null;
  }

  buildFromArch(model, prevSelectedId = null) {
	this.nodes.forEach(n => this.scene.remove(n));
	this.lines.forEach(l => this.scene.remove(l));
	this.nodes = [];
	this.lines = [];

	if (!model.root?.name || model.root.name === 'Empty Architecture') return null;

	const rootNode = this.createNode(model.root);
	this._buildChildren(model.root, model.root.pos, ArchModel.getColor(model.root, model.legend));

	if (prevSelectedId) {
	  this.selectedId = prevSelectedId;
	  return this.getNodeById(prevSelectedId);
	}
	return null;
  }

  _buildChildren(parentModel, parentPos, parentColor) {
	(parentModel.children || []).forEach(child => {
	  const sceneNode = this.createNode(child);
	  this.createLine(parentPos, child.pos, parentModel.id, child.id, parentColor);
	  this._buildChildren(child, child.pos, ArchModel.getColor(child, this.app.model.legend));
	});
  }

  showGizmoAt(node) {
	this.gizmoGroup.position.copy(node.position);
	this.gizmoGroup.visible = true;
  }

  hideGizmo() {
	this.gizmoGroup.visible = false;
  }

  updateGizmoPos(node) {
	if (this.gizmoGroup.visible) this.gizmoGroup.position.copy(node.position);
  }

  gizmoPointerDown(raycaster) {
	if (!this.gizmoGroup.visible) return null;
	const picks = raycaster.intersectObjects(this.gizmoGroup.children, true);
	if (!picks.length) return null;

	let obj = picks[0].object;
	while (obj && !obj.userData.axis) obj = obj.parent;

	if (obj?.userData.axis) {
	  this.axisDragging = obj.userData.axis;
	  return obj.userData.axis;
	}
	return null;
  }

  gizmoPointerMove(raycaster, node) {
	if (!this.axisDragging || !node) return null;

	const axisDir = new THREE.Vector3(
	  this.axisDragging === 'x' ? 1 : 0,
	  this.axisDragging === 'y' ? 1 : 0,
	  this.axisDragging === 'z' ? 1 : 0
	);

	const closest = this._closestPointOnAxis(raycaster.ray, this.gizmoGroup.position.clone(), axisDir);
	if (closest) {
	  node.position.copy(closest);
	  this.updateGizmoPos(node);
	  return closest;
	}
	return null;
  }

  _closestPointOnAxis(ray, origin, dir) {
	const p1 = origin;
	const d1 = dir.clone().normalize();
	const d2 = ray.direction.clone().normalize();
	const r = origin.clone().sub(ray.origin);

	const a = d1.dot(d1);
	const b = d1.dot(d2);
	const c = d2.dot(d2);
	const d = d1.dot(r);
	const e = d2.dot(r);
	const denom = a * c - b * b;

	const t = Math.abs(denom) > 1e-6 ? (b * e - c * d) / denom : 0;
	return p1.add(d1.multiplyScalar(t));
  }

  gizmoPointerUp() {
	this.axisDragging = null;
  }

  updateNodeColor(sceneNode, color) {
	const rg = sceneNode.userData?.rotatingGroup;
	if (rg) {
	  rg.children.forEach(c => {
		if (c.material?.color) c.material.color.set(color);
		if (c.isPointLight) c.color.set(color);
	  });
	}
  }

  update(frame) {
	this.nodes.forEach(n => {
	  if (n.userData?.rotatingGroup) {
		n.userData.rotatingGroup.rotation.y += n.userData.rotationSpeed;
		n.userData.rotatingGroup.rotation.x += n.userData.rotationSpeed * 0.5;
	  }
	});

	this.lines.forEach((line, i) => {
	  line.material.opacity = 0.3 + Math.sin(frame * 0.05 + i) * 0.2;

	  const startNode = line.userData.startId ? this.getNodeById(line.userData.startId) : null;
	  const endNode = line.userData.endId ? this.getNodeById(line.userData.endId) : null;

	  if (startNode || endNode) {
		const arr = line.geometry.attributes.position.array;
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
		line.geometry.attributes.position.needsUpdate = true;
	  }
	});

	if (this.particles) {
	  this.particles.rotation.y += 0.0003;
	  this.particles.rotation.x += 0.0001;
	}
  }

  render() {
	this.renderer.render(this.scene, this.camera);
  }

  resize(w = window.innerWidth, h = window.innerHeight) {
	this.camera.aspect = w / h;
	this.camera.updateProjectionMatrix();
	this.renderer.setSize(w, h);
  }

  startLoop(inputState, keys, mobile) {
	if (this._loopRunning) return;
	this._loopRunning = true;
	this._loopStop = false;

	let frame = 0;

	const loop = () => {
	  if (this._loopStop) {
		this._loopRunning = false;
		return;
	  }

	  requestAnimationFrame(loop);
	  frame++;

	  if (inputState.autoRotate) {
		inputState.targetOrbitAngle += 0.001;
	  }
	  inputState.currentOrbitAngle += (inputState.targetOrbitAngle - inputState.currentOrbitAngle) * (1 - this.smoothFactors.drag);
	  inputState.currentOrbitRadius += (inputState.targetOrbitRadius - inputState.currentOrbitRadius) * (1 - this.smoothFactors.zoom);
	  inputState.currentOrbitHeight += (inputState.targetOrbitHeight - inputState.currentOrbitHeight) * (1 - this.smoothFactors.drag);
	  inputState.currentX += (inputState.targetX - inputState.currentX) * (1 - this.smoothFactors.general);
	  inputState.currentY += (inputState.targetY - inputState.currentY) * (1 - this.smoothFactors.general);
	  inputState.currentZ += (inputState.targetZ - inputState.currentZ) * (1 - this.smoothFactors.general);

	  const moveSpeed = 0.3;
	  const forward = new THREE.Vector3(-Math.sin(inputState.currentOrbitAngle), 0, -Math.cos(inputState.currentOrbitAngle));
	  const right = new THREE.Vector3(Math.cos(inputState.currentOrbitAngle), 0, -Math.sin(inputState.currentOrbitAngle));

	  if (keys.w) { inputState.targetX += forward.x * moveSpeed; inputState.targetZ += forward.z * moveSpeed; }
	  if (keys.s) { inputState.targetX -= forward.x * moveSpeed; inputState.targetZ -= forward.z * moveSpeed; }
	  if (keys.a) { inputState.targetX -= right.x * moveSpeed; inputState.targetZ -= right.z * moveSpeed; }
	  if (keys.d) { inputState.targetX += right.x * moveSpeed; inputState.targetZ += right.z * moveSpeed; }
	  if (keys.space) inputState.targetY += moveSpeed;
	  if (keys.shift) inputState.targetY -= moveSpeed;

	  this.camera.position.x = inputState.currentX + Math.sin(inputState.currentOrbitAngle) * inputState.currentOrbitRadius;
	  this.camera.position.z = inputState.currentZ + Math.cos(inputState.currentOrbitAngle) * inputState.currentOrbitRadius;
	  this.camera.position.y = inputState.currentY + inputState.currentOrbitHeight;
	  this.camera.lookAt(inputState.currentX, inputState.currentY, inputState.currentZ);

	  this.update(frame);
	  this.render();

	  if (this.app.selectedNode) {
		this.updateGizmoPos(this.app.selectedNode);
		this.app.onFrameUpdate?.();
	  }
	};

	loop();
  }

  stopLoop() {
	this._loopStop = true;
  }
}
