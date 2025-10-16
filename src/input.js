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

export class InputHandler {
  constructor(app, renderer) {
	this.app = app;
	this.renderer = renderer;

	this.keys = { w: false, a: false, s: false, d: false, shift: false, space: false };
	this.inputState = {
	  currentOrbitAngle: 0, targetOrbitAngle: 0,
	  currentOrbitRadius: 50, targetOrbitRadius: 50,
	  currentOrbitHeight: 15, targetOrbitHeight: 15,
	  currentX: 0, targetX: 0,
	  currentY: 0, targetY: 0,
	  currentZ: 0, targetZ: 0,
	  isDragging: false, isMiddleDragging: false,
	  lastMouseX: 0, lastMouseY: 0,
	  autoRotate: true, inactivityTimer: null
	};

	this.raycaster = new THREE.Raycaster();
	this.mouse = new THREE.Vector2();
	this.mobile = { 
	  leftTouchId: null, rightTouchId: null, 
	  leftStart: null, rightStart: null, 
	  leftPos: { x: 0, y: 0 }, rightPos: { x: 0, y: 0 }, 
	  maxRadius: 44, upPressed: false, downPressed: false 
	};
	this.pinchStartDist = null;
	this.lastWheelTime = 0;

	this._init();
  }

  _init() {
		// CSS helpers (hide-cursor, hide-ui) are defined in css/style.css
	document.addEventListener('keydown', this._handleKeyDown.bind(this));
	document.addEventListener('keyup', this._handleKeyUp.bind(this));
	document.addEventListener('mousedown', this._handleMouseDown.bind(this));
	document.addEventListener('mouseup', this._handleMouseUp.bind(this));
	document.addEventListener('mousemove', this._handleMouseMove.bind(this));
	document.addEventListener('wheel', this._handleWheel.bind(this), { passive: false });
	document.addEventListener('click', this._handleClick.bind(this));
	document.addEventListener('contextmenu', (e) => e.preventDefault());

	this._setupTouchControls();
	this._setupMobileButtons();
  }

  _handleKeyDown(e) {
	const key = e.key.toLowerCase();
	if (key === 'w') this.keys.w = true;
	if (key === 'a') this.keys.a = true;
	if (key === 's') this.keys.s = true;
	if (key === 'd') this.keys.d = true;
	if (e.key === 'Shift') this.keys.shift = true;
	if (e.key === ' ') this.keys.space = true;
	
	if (key === 'q') {
	  document.body.classList.toggle('hide-cursor');
	}
	
	if (key === 'u') {
	  document.body.classList.toggle('hide-ui');
	  const uiToggle = document.getElementById('uiToggle');
	  if (uiToggle) {
		uiToggle.classList.toggle('visible');
	  }
	}
  }

  _handleKeyUp(e) {
	const key = e.key.toLowerCase();
	if (key === 'w') this.keys.w = false;
	if (key === 'a') this.keys.a = false;
	if (key === 's') this.keys.s = false;
	if (key === 'd') this.keys.d = false;
	if (e.key === 'Shift') this.keys.shift = false;
	if (e.key === ' ') this.keys.space = false;
  }

  _handleMouseDown(e) {
	this.inputState.autoRotate = false;
	this.resetAutoRotate();

	if (e.button === 0) {
	  this.inputState.isDragging = true;
	  this.inputState.lastMouseX = e.clientX;
	  this.inputState.lastMouseY = e.clientY;

	  if (this.app.ui.editMode) {
		this._gizmoPointerDown(e);
	  }
	} else if (e.button === 1 || e.button === 2) {
	  e.preventDefault();
	  this.inputState.isMiddleDragging = true;
	  this.inputState.lastMouseX = e.clientX;
	  this.inputState.lastMouseY = e.clientY;
	}
  }

  _handleMouseUp() {
	const wasGizmoDragging = !!this.renderer.axisDragging;

	this.inputState.isDragging = false;
	this.inputState.isMiddleDragging = false;
	this.renderer.gizmoPointerUp();

	if (wasGizmoDragging) {
	  document.body.classList.remove('grabbing');
	  if (this.app.selectedNode) {
		  const archNode = ArchModel.findById(this.app.model.root, this.app.selectedNode.userData.id);
		  if (archNode) {
			  archNode.pos = this.app.selectedNode.position.toArray();
		  }
	  }
	}
  }

  _handleMouseMove(e) {
	const deltaX = e.clientX - this.inputState.lastMouseX;
	const deltaY = e.clientY - this.inputState.lastMouseY;

	if (this.inputState.isDragging && this.app.ui.editMode && this.renderer.axisDragging) {
	  this._gizmoPointerMove(e);
	} else if (this.inputState.isDragging) {
	  this.inputState.targetOrbitAngle -= deltaX * 0.008;
	  this.inputState.targetOrbitHeight += deltaY * 0.15;
	  this.inputState.targetOrbitHeight = Math.max(-20, Math.min(35, this.inputState.targetOrbitHeight));
	} else if (this.inputState.isMiddleDragging) {
	  const right = new THREE.Vector3(Math.cos(this.inputState.currentOrbitAngle), 0, -Math.sin(this.inputState.currentOrbitAngle));
	  this.inputState.targetX += right.x * deltaX * 0.08;
	  this.inputState.targetZ += right.z * deltaX * 0.08;
	  this.inputState.targetY -= deltaY * 0.08;
	}

	this.inputState.lastMouseX = e.clientX;
	this.inputState.lastMouseY = e.clientY;
  }

  _handleWheel(e) {
	if (this.app.ui.editMode) return;
	e.preventDefault();

	const s = 1 - this.renderer.smoothFactors.zoom * 2;
	const p = Math.min(Math.abs(e.deltaY) / 100, 5);

	this.inputState.targetOrbitRadius *= 1 - Math.sign(e.deltaY) * 0.1 * p * s;
  }

  _gizmoPointerDown(e) {
	if (e.button !== 0) return;
	const rect = this.renderer.renderer.domElement.getBoundingClientRect();
	this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
	this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
	this.raycaster.setFromCamera(this.mouse, this.renderer.camera);

	if (this.renderer.gizmoPointerDown(this.raycaster)) {
	  document.body.classList.add('grabbing');
	  e.preventDefault();
	}
  }

  _gizmoPointerMove(e) {
	const rect = this.renderer.renderer.domElement.getBoundingClientRect();
	this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
	this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
	this.raycaster.setFromCamera(this.mouse, this.renderer.camera);
	this.renderer.gizmoPointerMove(this.raycaster, this.app.selectedNode);
  }

  _handleClick(e) {
	if (e.target?.closest?.('.ui-container, .panel-box, .button')) return;
	if (e.button !== 0) return;

	const rect = this.renderer.renderer.domElement.getBoundingClientRect();
	this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
	this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
	this.raycaster.setFromCamera(this.mouse, this.renderer.camera);

	const intersects = this.raycaster.intersectObjects(this.renderer.nodes, true);
	if (intersects?.length) {
	  let obj = intersects[0].object;
	  while (obj && !this.renderer.nodes.includes(obj)) obj = obj.parent;

	  if (obj) {
		const id = obj.userData?.id;
		this.app.selectNode(id, obj);
		return;
	  }
	}

	this.app.deselectNode();
  }

  _setupTouchControls() {
	document.addEventListener('touchstart', (e) => {
	  if (e.touches.length === 2) {
		this.pinchStartDist = this._getDist(e.touches[0], e.touches[1]);
	  }
	  this.resetAutoRotate();
	}, { passive: true });

	document.addEventListener('touchmove', (e) => {
	  if (e.touches.length === 2) {
		const d = this._getDist(e.touches[0], e.touches[1]);
		if (this.pinchStartDist) {
		  this.inputState.targetOrbitRadius -= (d - this.pinchStartDist) * 0.03;
		  this.inputState.targetOrbitRadius = Math.max(15, Math.min(100, this.inputState.targetOrbitRadius));
		  this.pinchStartDist = d;
		}
	  }
	  if (e.touches.length >= 1) e.preventDefault();
	}, { passive: false });

	document.addEventListener('touchend', (e) => {
	  if (e.touches.length < 2) this.pinchStartDist = null;
	}, { passive: true });
  }

  _setupMobileButtons() {
	const btnUp = document.getElementById('btnUp');
	const btnDown = document.getElementById('btnDown');

	if (btnUp) {
	  btnUp.addEventListener('mousedown', () => { 
		this.mobile.upPressed = true; 
		btnUp.classList.add('active'); 
	  });
	  btnUp.addEventListener('mouseup', () => { 
		this.mobile.upPressed = false; 
		btnUp.classList.remove('active'); 
	  });
	}

	if (btnDown) {
	  btnDown.addEventListener('mousedown', () => { 
		this.mobile.downPressed = true; 
		btnDown.classList.add('active'); 
	  });
	  btnDown.addEventListener('mouseup', () => { 
		this.mobile.downPressed = false; 
		btnDown.classList.remove('active'); 
	  });
	}
  }

  _getDist(t1, t2) {
	const dx = t1.clientX - t2.clientX;
	const dy = t1.clientY - t2.clientY;
	return Math.hypot(dx, dy);
  }

  resetAutoRotate() {
	clearTimeout(this.inputState.inactivityTimer);
	this.inputState.inactivityTimer = setTimeout(() => {
	  if (!this.app.ui.editMode) this.inputState.autoRotate = true;
	}, 3000);
  }
}
