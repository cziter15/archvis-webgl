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
export class InputHandler {
	constructor(app, renderer) {
		this.app = app;
		this.renderer = renderer;
		this.keys = {
			w: false,
			a: false,
			s: false,
			d: false,
			shift: false,
			space: false
		};
		this.inputState = {
			currentOrbitAngle: 0,
			targetOrbitAngle: 0,
			currentOrbitRadius: 50,
			targetOrbitRadius: 50,
			currentOrbitHeight: 15,
			targetOrbitHeight: 15,
			currentX: 0,
			targetX: 0,
			currentY: 0,
			targetY: 0,
			currentZ: 0,
			targetZ: 0,
			isDragging: false,
			isMiddleDragging: false,
			lastMouseX: 0,
			lastMouseY: 0,
			autoRotate: true,
			inactivityTimer: null
		};
		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();
		this.mobile = {
			leftTouchId: null,
			rightTouchId: null,
			leftStart: null,
			rightStart: null,
			leftPos: {
				x: 0,
				y: 0
			},
			rightPos: {
				x: 0,
				y: 0
			},
			maxRadius: 44,
			upPressed: false,
			downPressed: false
		};
		this.pinchStartDist = null;
		this.lastWheelTime = 0;
		this.isMobile = !!(this.app && this.app.ui && this.app.ui.isMobile);
		if (this.isMobile) this.inputState.autoRotate = false;
		this._init();
	}
	_init() {
		document.addEventListener('keydown', this._handleKeyDown.bind(this));
		document.addEventListener('keyup', this._handleKeyUp.bind(this));
		document.addEventListener('mousedown', this._handleMouseDown.bind(this));
		document.addEventListener('mouseup', this._handleMouseUp.bind(this));
		document.addEventListener('mousemove', this._handleMouseMove.bind(this));
		document.addEventListener('wheel', this._handleWheel.bind(this), {
			passive: false
		});
		document.addEventListener('click', this._handleClick.bind(this));
		document.addEventListener('contextmenu', (e) => e.preventDefault());
		this._setupTouchControls();
		this._setupMobileButtons();
		this._setupMobileSticks();
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
			if (this.app && this.app.ui && typeof this.app.ui.updateMobileUI === 'function') this.app.ui.updateMobileUI();
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
			if (this.app.ui.editMode) this._gizmoPointerDown(e);
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
			const selId = this.app?.model?.getSelected ? this.app.model.getSelected() : null;
			const sceneNode = selId ? this.renderer.getNodeById(selId) : null;
			if (sceneNode) {
				const archNode = ArchModel.findById(this.app.model.root, sceneNode.userData.id);
				if (archNode) archNode.pos = sceneNode.position.toArray();
			}
		}
	}
	_handleMouseMove(e) {
		const deltaX = e.clientX - this.inputState.lastMouseX;
		const deltaY = e.clientY - this.inputState.lastMouseY;
		if (this.inputState.isDragging && this.app.ui.editMode && this.renderer.axisDragging) this._gizmoPointerMove(e);
		else if (this.inputState.isDragging) {
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
		const selId = this.app?.model?.getSelected ? this.app.model.getSelected() : null;
		const sceneNode = selId ? this.renderer.getNodeById(selId) : null;
		this.renderer.gizmoPointerMove(this.raycaster, sceneNode);
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
				if (this.app?.model && typeof this.app.model.setSelected === 'function') this.app.model.setSelected(id);
				return;
			}
		}
		if (this.app?.model && typeof this.app.model.setSelected === 'function') this.app.model.setSelected(null);
	}
	_setupTouchControls() {
		document.addEventListener('touchstart', (e) => {
			if (e.touches.length === 2) this.pinchStartDist = this._getDist(e.touches[0], e.touches[1]);
			this.resetAutoRotate();
		}, {
			passive: true
		});
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
		}, {
			passive: false
		});
		document.addEventListener('touchend', (e) => {
			if (e.touches.length < 2) this.pinchStartDist = null;
		}, {
			passive: true
		});
	}
	_setupMobileButtons() {
		const btnUp = document.getElementById('btnUp');
		const btnDown = document.getElementById('btnDown');
		if (btnUp) {
			const downHandler = (ev) => {
				this.mobile.upPressed = true;
				btnUp.classList.add('active');
				ev.preventDefault?.();
			};
			const upHandler = (ev) => {
				this.mobile.upPressed = false;
				btnUp.classList.remove('active');
				ev.preventDefault?.();
			};
			btnUp.addEventListener('mousedown', downHandler);
			btnUp.addEventListener('mouseup', upHandler);
			btnUp.addEventListener('mouseleave', upHandler);
			btnUp.addEventListener('pointerdown', (e) => {
				if (e.pointerType === 'touch' || e.pointerType === 'pen' || e.pointerType === 'mouse') downHandler(e);
			});
			btnUp.addEventListener('pointerup', (e) => {
				if (e.pointerType === 'touch' || e.pointerType === 'pen' || e.pointerType === 'mouse') upHandler(e);
			});
			btnUp.addEventListener('touchstart', (e) => {
				downHandler(e);
			}, {
				passive: false
			});
			btnUp.addEventListener('touchend', (e) => {
				upHandler(e);
			}, {
				passive: false
			});
			btnUp.addEventListener('touchcancel', (e) => {
				upHandler(e);
			}, {
				passive: false
			});
		}
		if (btnDown) {
			const downHandlerD = (ev) => {
				this.mobile.downPressed = true;
				btnDown.classList.add('active');
				ev.preventDefault?.();
			};
			const upHandlerD = (ev) => {
				this.mobile.downPressed = false;
				btnDown.classList.remove('active');
				ev.preventDefault?.();
			};
			btnDown.addEventListener('mousedown', downHandlerD);
			btnDown.addEventListener('mouseup', upHandlerD);
			btnDown.addEventListener('mouseleave', upHandlerD);
			btnDown.addEventListener('pointerdown', (e) => {
				if (e.pointerType === 'touch' || e.pointerType === 'pen' || e.pointerType === 'mouse') downHandlerD(e);
			});
			btnDown.addEventListener('pointerup', (e) => {
				if (e.pointerType === 'touch' || e.pointerType === 'pen' || e.pointerType === 'mouse') upHandlerD(e);
			});
			btnDown.addEventListener('touchstart', (e) => {
				downHandlerD(e);
			}, {
				passive: false
			});
			btnDown.addEventListener('touchend', (e) => {
				upHandlerD(e);
			}, {
				passive: false
			});
			btnDown.addEventListener('touchcancel', (e) => {
				upHandlerD(e);
			}, {
				passive: false
			});
		}
	}
	_setupMobileSticks() {
		const left = document.getElementById('leftStick');
		const right = document.getElementById('rightStick');
		const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
		const setupStick = (el, posKey) => {
			if (!el) return;
			const knob = el.querySelector('.stick-knob');
			if (!knob) return;
			const onPointerDown = (e) => {
				if (typeof el.setPointerCapture === 'function') {
					try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore capture errors */ }
				}
				this.resetAutoRotate();
				if (posKey === 'left') {
					if (this.mobile.leftTouchId == null) this.mobile.leftTouchId = e.pointerId;
					else return;
				}
				if (posKey === 'right') {
					if (this.mobile.rightTouchId == null) this.mobile.rightTouchId = e.pointerId;
					else return;
				}
				updateFromEvent(e);
			};
			const onPointerMove = (e) => {
				const id = e.pointerId;
				if (posKey === 'left') {
					if (this.mobile.leftTouchId === null) return;
					if (this.mobile.leftTouchId !== id) return;
				}
				if (posKey === 'right') {
					if (this.mobile.rightTouchId === null) return;
					if (this.mobile.rightTouchId !== id) return;
				}
				updateFromEvent(e);
			};
			const onPointerUp = (e) => {
				if (typeof el.releasePointerCapture === 'function') {
					try { el.releasePointerCapture(e.pointerId); } catch (err) { /* ignore release errors */ }
				}
				if (posKey === 'left') {
					this.mobile.leftTouchId = null;
					this.mobile.leftPos.x = 0;
					this.mobile.leftPos.y = 0;
				}
				if (posKey === 'right') {
					this.mobile.rightTouchId = null;
					this.mobile.rightPos.x = 0;
					this.mobile.rightPos.y = 0;
				}
				knob.style.transform = 'translate(0px, 0px)';
			};
			const updateFromEvent = (e) => {
				const rect = el.getBoundingClientRect();
				const cx = rect.left + rect.width / 2;
				const cy = rect.top + rect.height / 2;
				const dx = e.clientX - cx;
				const dy = e.clientY - cy;
				const r = Math.max(20, Math.min(this.mobile.maxRadius || 44, rect.width / 2 - 8));
				const d = Math.hypot(dx, dy);
				const ndx = dx === 0 && dy === 0 ? 0 : dx * Math.min(1, r / Math.max(d, 0.0001));
				const ndy = dy === 0 && dx === 0 ? 0 : dy * Math.min(1, r / Math.max(d, 0.0001));
				knob.style.transform = `translate(${ndx}px, ${ndy}px)`;
				const nx = clamp(ndx / r, -1, 1);
				const ny = clamp(ndy / r, -1, 1);
				if (posKey === 'left') {
					this.mobile.leftPos.x = nx;
					this.mobile.leftPos.y = ny;
				} else {
					this.mobile.rightPos.x = nx;
					this.mobile.rightPos.y = ny;
				}
			};
			el.addEventListener('pointerdown', onPointerDown);
			window.addEventListener('pointermove', onPointerMove);
			window.addEventListener('pointerup', onPointerUp);
			el.addEventListener('touchstart', (ev) => {
				this.resetAutoRotate();
				ev.preventDefault();
				const rect = el.getBoundingClientRect();
				for (let i = 0; i < ev.changedTouches.length; i++) {
					const t = ev.changedTouches[i];
					if (t.clientX >= rect.left && t.clientX <= rect.right && t.clientY >= rect.top && t.clientY <= rect.bottom) {
						if (posKey === 'left') {
							if (this.mobile.leftTouchId == null) {
								this.mobile.leftTouchId = t.identifier;
								updateFromEvent(t);
							}
						} else {
							if (this.mobile.rightTouchId == null) {
								this.mobile.rightTouchId = t.identifier;
								updateFromEvent(t);
							}
						}
						break;
					}
				}
			}, {
				passive: false
			});
			el.addEventListener('touchmove', (ev) => {
				ev.preventDefault();
				const id = posKey === 'left' ? this.mobile.leftTouchId : this.mobile.rightTouchId;
				if (id == null) return;
				for (let i = 0; i < ev.changedTouches.length; i++) {
					const t = ev.changedTouches[i];
					if (t.identifier === id) {
						updateFromEvent(t);
						break;
					}
				}
			}, {
				passive: false
			});
			el.addEventListener('touchend', (ev) => {
				ev.preventDefault();
				for (let i = 0; i < ev.changedTouches.length; i++) {
					const t = ev.changedTouches[i];
					if (posKey === 'left' && t.identifier === this.mobile.leftTouchId) {
						this.mobile.leftTouchId = null;
						this.mobile.leftPos.x = 0;
						this.mobile.leftPos.y = 0;
						knob.style.transform = 'translate(0px, 0px)';
						break;
					}
					if (posKey === 'right' && t.identifier === this.mobile.rightTouchId) {
						this.mobile.rightTouchId = null;
						this.mobile.rightPos.x = 0;
						this.mobile.rightPos.y = 0;
						knob.style.transform = 'translate(0px, 0px)';
						break;
					}
				}
			}, {
				passive: false
			});
		};
		setupStick(left, 'left');
		setupStick(right, 'right');
	}
	_getDist(t1, t2) {
		const dx = t1.clientX - t2.clientX;
		const dy = t1.clientY - t2.clientY;
		return Math.hypot(dx, dy);
	}
	resetAutoRotate() {
		clearTimeout(this.inputState.inactivityTimer);
		this.inputState.inactivityTimer = setTimeout(() => {
			const isMobile = !!(this.app && this.app.ui && this.app.ui.isMobile);
			const editMode = !!(this.app && this.app.ui && this.app.ui.editMode);
			if (!editMode && !isMobile) this.inputState.autoRotate = true;
		}, 3000);
	}
}