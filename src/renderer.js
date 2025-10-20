/*
 *	Copyright (c) 2025-2026, Krzysztof Strehlau
 *
 *	This file is a part of the ArchVis WebGL utility.
 *	All licensing information can be found inside LICENSE.md file.
 *
 *	https://github.com/cziter15/archvis-webgl/blob/main/LICENSE
 */
import * as THREE from 'three';
import {
	ArchModel
} from './model.js';

import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
export class ArchRenderer {
	constructor(app, canvas) {
		this.app = app;
		this.scene = new THREE.Scene();
		this.scene.fog = new THREE.FogExp2(0x000510, 0.008);
		const initW = (canvas && canvas.clientWidth) || window.innerWidth;
		const initH = (canvas && canvas.clientHeight) || window.innerHeight;
		this.camera = new THREE.PerspectiveCamera(60, initW / initH, 0.1, 1000);
		this.camera.position.set(0, 15, 50);
		this.camera.lookAt(0, 0, 0);
		this.renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true
		});
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		const w = (canvas && canvas.clientWidth) || window.innerWidth;
		const h = (canvas && canvas.clientHeight) || window.innerHeight;
		this.renderer.setSize(w, h);
		this.renderer.setClearColor(0x000510);
		if (canvas) canvas.appendChild(this.renderer.domElement);
		this.resize();
		this._shared = {
			nodeBoxGeo: new THREE.BoxGeometry(0.6, 0.6, 0.6),
			nodeInnerGeo: new THREE.BoxGeometry(0.4, 0.4, 0.4),
			shaftGeo: new THREE.CylinderGeometry(0.12, 0.12, 1, 12),
			coneGeo: new THREE.ConeGeometry(0.18, 0.3, 12),
			nodePlateDepth: 0.2,
			planeGeo: new THREE.BoxGeometry(5.2, 0.9, 0.08)
		};
		this._lineMaterials = [];
		this._setupLighting();
		this._setupParticles();
		this._setupGizmo();
		this._bindResize();
		this.nodes = [];
		this.lines = [];
		this.selectedId = null;
		this.axisDragging = null;
		this.smoothFactors = {
			drag: 0.95,
			zoom: 0.95,
			general: 0.95
		};
		this.textCache = new Map();
		if (this.app?.model?.onChange) {
			this.app.model.onChange((payload) => {
				try {
					if (!payload || payload.type === 'rebuild') {
						ArchModel.assignIds(this.app.model.root);
						this.app.model.legend?.forEach(e => {
							if (!e.id) e.id = Math.random().toString(36).slice(2, 9);
						});
						ArchModel.mapColorsToLegend(this.app.model.root, this.app.model.legend);
						const prevId = this.app?.model?.getSelected ? this.app.model.getSelected() : this.selectedId;
						this.buildFromArch(this.app.model, prevId);
						return;
					}
					if (payload.type === 'node-updated' && payload.id) {
						const sceneNode = this.getNodeById(payload.id);
						if (sceneNode) {
							if (payload.changes && payload.changes.pos) {
								sceneNode.position.set(...payload.changes.pos);
								this.lines.forEach(line => {
									const startId = line.userData.startId;
									const endId = line.userData.endId;
									if (startId === payload.id || endId === payload.id) {
										const startNode = startId ? this.getNodeById(startId) : null;
										const endNode = endId ? this.getNodeById(endId) : null;
										this._updateLineMesh(line, startNode, endNode);
									}
								});
							}
							if (payload.changes && payload.changes.name) {
								const newText = this._createTextMesh(payload.changes.name, payload.changes.color || 0x00ffff);
								if (sceneNode.children[1]) sceneNode.remove(sceneNode.children[1]);
								newText.position.y = sceneNode.userData?.scale ? 1.5 * sceneNode.userData.scale : 1.5;
								sceneNode.add(newText);
							}
							return;
						}
						const prevId = this.selectedId;
						this.buildFromArch(this.app.model, prevId);
						return;
					}
					if (payload.type === 'node-added' && payload.id) {
						const newNode = ArchModel.findById(this.app.model.root, payload.id);
						if (newNode) {
							this.addNodeToScene(newNode, payload.parentId);
							return;
						}
						const prevIdA = this.selectedId;
						this.buildFromArch(this.app.model, prevIdA);
						return;
					}
					if (payload.type === 'node-removed' && payload.id) {
						this.removeNodeFromScene(payload.id);
						return;
					}
					if (payload.type === 'legend-changed') {
						const prevId = this.selectedId;
						this.buildFromArch(this.app.model, prevId);
						return;
					}
					const prevId2 = this.selectedId;
					this.buildFromArch(this.app.model, prevId2);
				} catch (err) {
					console.error('Error handling model change payload', err);
					const prevId = this.selectedId;
					this.buildFromArch(this.app.model, prevId);
				}
			});
		}
		if (this.app?.model?.onSelect) {
			this.app.model.onSelect((id) => {
				this.selectedId = id;
				const node = id ? this.getNodeById(id) : null;
				if (this.app?.ui?.editMode) {
					if (node) this.showGizmoAt(node);
					else this.hideGizmo();
				} else this.hideGizmo();
			});
		}
	}
	_setupLighting() {
		this.scene.add(new THREE.AmbientLight(0x1a1a3e, 0.8));
		const lights = [{
			color: 0x00ffff,
			intensity: 1.5,
			distance: 60,
			position: [15, 15, 15]
		}, {
			color: 0xff00ff,
			intensity: 1.5,
			distance: 60,
			position: [-15, 10, -15]
		}, {
			color: 0xffffff,
			intensity: 1,
			distance: 40,
			position: [0, 20, 0]
		}];
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
		const mat = new THREE.PointsMaterial({
			size: 0.05,
			color: 0x00ffff,
			transparent: true,
			opacity: 0.6
		});
		this.particles = new THREE.Points(geo, mat);
		this.scene.add(this.particles);
	}
	_setupGizmo() {
		this.gizmoGroup = new THREE.Group();
		this.gizmoGroup.visible = false;
		const axes = [{
			axis: 'x',
			color: 0xff0000,
			rot: [0, 0, -Math.PI / 2]
		}, {
			axis: 'y',
			color: 0x00ff00,
			rot: [0, 0, 0]
		}, {
			axis: 'z',
			color: 0x0000ff,
			rot: [Math.PI / 2, 0, 0]
		}];
		axes.forEach(({
			axis,
			color,
			rot
		}) => {
			const mat = new THREE.MeshBasicMaterial({
				color
			});
			const shaft = new THREE.Mesh(this._shared.shaftGeo, mat);
			shaft.rotation.set(...rot);
			shaft.position[axis] = 0.5;
			const cone = new THREE.Mesh(this._shared.coneGeo, mat);
			cone.rotation.set(...rot);
			cone.position[axis] = 1.05;
			const group = new THREE.Group();
			group.add(shaft, cone);
			group.userData = {
				axis
			};
			this.gizmoGroup.add(group);
		});
		this.scene.add(this.gizmoGroup);
	}
	_createTextMesh(text, color) {
		const cacheKey = `${text}_${color}`;
		if (this.textCache.has(cacheKey)) return this.textCache.get(cacheKey).clone();
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
		const mat = new THREE.MeshBasicMaterial({
			map: texture,
			transparent: true,
			side: THREE.DoubleSide
		});
		const text3d = new THREE.Mesh(geo, mat);
		const plateDepth = this._shared.nodePlateDepth || 0.2;
		const frontMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, metalness: 0.1, roughness: 0.6 });
		const sideMat = new THREE.MeshStandardMaterial({ color: 0x05050a, metalness: 0.05, roughness: 0.8 });
		const backMat = new THREE.MeshStandardMaterial({ color: 0x000510, metalness: 0.02, roughness: 0.9 });
		const plateWidth = 5.2;
		const plateHeight = 0.9;
		const plateGeo = new THREE.BoxGeometry(plateWidth, plateHeight, plateDepth);
		const boxMaterials = [sideMat, sideMat, sideMat, sideMat, frontMat, backMat];
		const back = new THREE.Mesh(plateGeo, boxMaterials);
		back.position.z = 0;
		const frontPlane = new THREE.PlaneGeometry(plateWidth, plateHeight);
		const edgesGeo = new THREE.EdgesGeometry(frontPlane);
		const posAttr = edgesGeo.attributes.position;
		const positions = [];
		for (let i = 0; i < posAttr.count; i++) {
			positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
		}
		const lineGeometry = new LineSegmentsGeometry();
		lineGeometry.setPositions(positions);
		const lineMaterial = new LineMaterial({
			color: color,
			linewidth: 2,
			transparent: true,
			opacity: 1.0
		});
		this._lineMaterials.push(lineMaterial);
		if (this.renderer && this.renderer.domElement) lineMaterial.resolution.set(this.renderer.domElement.clientWidth, this.renderer.domElement.clientHeight);
		const frame = new LineSegments2(lineGeometry, lineMaterial);
		const frontZ = plateDepth / 2;
		text3d.position.z = frontZ + 0.001;
		frame.position.z = frontZ + 0.002;
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
		const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.6 * scale, 0.6 * scale, 0.6 * scale));
		const lineMat = new THREE.LineBasicMaterial({
			color,
			linewidth: 2
		});
		rotatingGroup.add(new THREE.LineSegments(edges, lineMat));
		const glowMat = new THREE.MeshBasicMaterial({
			color,
			transparent: true,
			opacity: 0.3,
			wireframe: true
		});
		rotatingGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 0.4 * scale, 0.4 * scale), glowMat));
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
	addNodeToScene(node, parentId) {
		const sceneNode = this.createNode(node);
		let parentNode = null;
		if (parentId) parentNode = this.getNodeById(parentId);
		else {
			const parentModel = this._findParentModel(this.app.model.root, node.id);
			if (parentModel) parentNode = this.getNodeById(parentModel.id);
		}
		if (parentNode) this.createLine(parentNode.position.toArray(), sceneNode.position.toArray(), parentNode.userData.id, sceneNode.userData.id, parentNode.userData?.color || ArchModel.getColor(parentNode.userData || {}, this.app.model.legend));
		else if (this.app.model.root) this.createLine(this.app.model.root.pos, sceneNode.position.toArray(), this.app.model.root.id, sceneNode.userData.id, ArchModel.getColor(this.app.model.root, this.app.model.legend));
		return sceneNode;
	}
	removeNodeFromScene(id) {
		const node = this.getNodeById(id);
		if (node) {
			const toRemove = this.lines.filter(l => l.userData.startId === id || l.userData.endId === id);
			toRemove.forEach(line => {
				this.scene.remove(line);
				const idx = this.lines.indexOf(line);
				if (idx !== -1) this.lines.splice(idx, 1);
			});
			const descendants = this._collectDescendantIds(id);
			descendants.forEach(cid => {
				const cnode = this.getNodeById(cid);
				if (cnode) {
					this.scene.remove(cnode);
					const ni = this.nodes.indexOf(cnode);
					if (ni !== -1) this.nodes.splice(ni, 1);
				}
				const childLines = this.lines.filter(l => l.userData.startId === cid || l.userData.endId === cid);
				childLines.forEach(line => {
					this.scene.remove(line);
					const li = this.lines.indexOf(line);
					if (li !== -1) this.lines.splice(li, 1);
				});
			});
			this.scene.remove(node);
			const idx = this.nodes.indexOf(node);
			if (idx !== -1) this.nodes.splice(idx, 1);
		}
		if (this.selectedId === id) {
			this.selectedId = null;
			if (this.app?.model?.setSelected) this.app.model.setSelected(null);
			this.hideGizmo();
		}
	}
	_collectDescendantIds(id) {
		const out = [];
		const collect = (m) => {
			(m.children || []).forEach(c => {
				out.push(c.id);
				collect(c);
			});
		};
		const parent = ArchModel.findById(this.app.model.root, id);
		if (!parent) return out;
		collect(parent);
		return out;
	}
	_findParentModel(root, childId) {
		if (!root) return null;
		if ((root.children || []).some(c => c.id === childId)) return root;
		for (const c of (root.children || [])) {
			const found = this._findParentModel(c, childId);
			if (found) return found;
		}
		return null;
	}
	createLine(startPos, endPos, startId, endId, color) {
		const p1 = new THREE.Vector3(startPos[0], startPos[1], startPos[2]);
		const p2 = new THREE.Vector3(endPos[0], endPos[1], endPos[2]);
		const dir = new THREE.Vector3().subVectors(p2, p1);
		const length = Math.max(dir.length(), 1e-6);
		const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
		const radius = 0.08;
		const cylGeo = new THREE.CylinderGeometry(radius, radius, 1, 8, 1, true);
		const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
		const mesh = new THREE.Mesh(cylGeo, mat);
		mesh.position.copy(mid);
		mesh.userData = { startId, endId, meshType: 'cylinder', baseRadius: radius };
		const up = new THREE.Vector3(0, 1, 0);
		const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
		mesh.quaternion.copy(q);
		mesh.scale.set(1, length, 1);
		this.scene.add(mesh);
		this.lines.push(mesh);
		return mesh;
	}

	_updateLineMesh(line, startNode, endNode) {
		if (!startNode && !endNode) return;
		if (line.userData?.meshType !== 'cylinder') return;
		const p1 = startNode ? startNode.position.clone() : new THREE.Vector3(...(this.app.model.root?.pos || [0,0,0]));
		const p2 = endNode ? endNode.position.clone() : new THREE.Vector3(...(this.app.model.root?.pos || [0,0,0]));
		const dir = new THREE.Vector3().subVectors(p2, p1);
		const length = Math.max(dir.length(), 1e-6);
		const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
		line.position.copy(mid);
		const up = new THREE.Vector3(0, 1, 0);
		const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
		line.quaternion.copy(q);
		line.scale.set(1, length, 1);
		if (line.material) line.material.opacity = line.material.opacity; 
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
		const axisDir = new THREE.Vector3(this.axisDragging === 'x' ? 1 : 0, this.axisDragging === 'y' ? 1 : 0, this.axisDragging === 'z' ? 1 : 0);
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
	update(frame) {
		for (let i = 0; i < this.nodes.length; i++) {
			const n = this.nodes[i];
			if (n.userData && n.userData.rotatingGroup) {
				n.userData.rotatingGroup.rotation.y += n.userData.rotationSpeed;
				n.userData.rotatingGroup.rotation.x += n.userData.rotationSpeed * 0.5;
			}
		}
		for (let i = 0; i < this.lines.length; i++) {
			const line = this.lines[i];
			if (line.material) line.material.opacity = 0.3 + Math.sin(frame * 0.05 + i) * 0.2;
			const startNode = line.userData.startId ? this.getNodeById(line.userData.startId) : null;
			const endNode = line.userData.endId ? this.getNodeById(line.userData.endId) : null;
			if (startNode || endNode) {
				this._updateLineMesh(line, startNode, endNode);
			}
		}
		if (this.particles) {
			this.particles.rotation.y += 0.0003;
			this.particles.rotation.x += 0.0001;
		}
	}
	render() {
		this.renderer.render(this.scene, this.camera);
	}
	resize(w, h) {
		const canvasEl = this.renderer?.domElement;
		if (typeof w === 'undefined' || typeof h === 'undefined') {
			if (canvasEl && canvasEl.parentElement) {
				w = canvasEl.parentElement.clientWidth || window.innerWidth;
				h = canvasEl.parentElement.clientHeight || window.innerHeight;
			} else {
				w = window.innerWidth;
				h = window.innerHeight;
			}
		}
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		this.renderer.setSize(w, h);
		const rw = this.renderer?.domElement?.clientWidth || w;
		const rh = this.renderer?.domElement?.clientHeight || h;
		if (Array.isArray(this._lineMaterials) && this._lineMaterials.length) {
			this._lineMaterials.forEach(mat => {
				if (mat && mat.resolution && typeof mat.resolution.set === 'function') {
					mat.resolution.set(rw, rh);
				}
			});
		}
	}
	_bindResize() {
		const onResize = () => this.resize();
		window.addEventListener('resize', onResize);
		this._onResize = onResize;
		const onOrientation = () => {
			setTimeout(() => this.resize(), 220);
			setTimeout(() => this.resize(), 520);
		};
		window.addEventListener('orientationchange', onOrientation);
		this._onOrientation = onOrientation;
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
			if (inputState.autoRotate) inputState.targetOrbitAngle += 0.001;
			inputState.currentOrbitAngle += (inputState.targetOrbitAngle - inputState.currentOrbitAngle) * (1 - this.smoothFactors.drag);
			inputState.currentOrbitRadius += (inputState.targetOrbitRadius - inputState.currentOrbitRadius) * (1 - this.smoothFactors.zoom);
			inputState.currentOrbitHeight += (inputState.targetOrbitHeight - inputState.currentOrbitHeight) * (1 - this.smoothFactors.drag);
			inputState.currentX += (inputState.targetX - inputState.currentX) * (1 - this.smoothFactors.general);
			inputState.currentY += (inputState.targetY - inputState.currentY) * (1 - this.smoothFactors.general);
			inputState.currentZ += (inputState.targetZ - inputState.currentZ) * (1 - this.smoothFactors.general);
			const moveSpeed = 0.3;
			const forward = new THREE.Vector3(-Math.sin(inputState.currentOrbitAngle), 0, -Math.cos(inputState.currentOrbitAngle));
			const right = new THREE.Vector3(Math.cos(inputState.currentOrbitAngle), 0, -Math.sin(inputState.currentOrbitAngle));
			if (keys.w) {
				inputState.targetX += forward.x * moveSpeed;
				inputState.targetZ += forward.z * moveSpeed;
			}
			if (keys.s) {
				inputState.targetX -= forward.x * moveSpeed;
				inputState.targetZ -= forward.z * moveSpeed;
			}
			if (keys.a) {
				inputState.targetX -= right.x * moveSpeed;
				inputState.targetZ -= right.z * moveSpeed;
			}
			if (keys.d) {
				inputState.targetX += right.x * moveSpeed;
				inputState.targetZ += right.z * moveSpeed;
			}
			if (keys.space) inputState.targetY += moveSpeed;
			if (keys.shift) inputState.targetY -= moveSpeed;
			if (mobile?.leftPos) {
				const l = mobile.leftPos;
				if (Math.abs(l.x) > 0.05) {
					inputState.targetX += right.x * l.x * moveSpeed;
					inputState.targetZ += right.z * l.x * moveSpeed;
				}
				if (Math.abs(l.y) > 0.05) {
					inputState.targetX += forward.x * -l.y * moveSpeed;
					inputState.targetZ += forward.z * -l.y * moveSpeed;
				}
			}
			if (mobile?.upPressed) inputState.targetY += moveSpeed;
			if (mobile?.downPressed) inputState.targetY -= moveSpeed;
			if (mobile?.rightPos) {
				const rpos = mobile.rightPos;
				if (Math.abs(rpos.x) > 0.02) {
					inputState.targetOrbitAngle -= rpos.x * 0.02;
				}
				if (Math.abs(rpos.y) > 0.02) {
					inputState.targetOrbitHeight += rpos.y * 0.3;
					inputState.targetOrbitHeight = Math.max(-20, Math.min(35, inputState.targetOrbitHeight));
				}
			}
			this.camera.position.x = inputState.currentX + Math.sin(inputState.currentOrbitAngle) * inputState.currentOrbitRadius;
			this.camera.position.z = inputState.currentZ + Math.cos(inputState.currentOrbitAngle) * inputState.currentOrbitRadius;
			this.camera.position.y = inputState.currentY + inputState.currentOrbitHeight;
			this.camera.lookAt(inputState.currentX, inputState.currentY, inputState.currentZ);
			this.update(frame);
			this.render();
			const selId = this.app?.model?.getSelected ? this.app.model.getSelected() : null;
			const selNode = selId ? this.getNodeById(selId) : null;
			if (selNode) {
				this.updateGizmoPos(selNode);
				this.app?.ui?.updateEditPanelValues?.();
			}
		};
		loop();
	}
	stopLoop() {
		this._loopStop = true;
	}
}