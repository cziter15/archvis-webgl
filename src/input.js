// Input handling module
// Manages keyboard, mouse, touch inputs for camera and UI controls

import * as THREE from 'three';

// Input state
export const keys = { w: false, a: false, s: false, d: false, shift: false, space: false };

export const mobile = {
    leftTouchId: null,
    rightTouchId: null,
    leftStart: null,
    rightStart: null,
    leftPos: { x: 0, y: 0 },
    rightPos: { x: 0, y: 0 },
    maxRadius: 44
};
mobile.upPressed = false;
mobile.downPressed = false;

export const inputState = {
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
    inactivityTimer: null,
    editMode: false
};

export const raycaster = new THREE.Raycaster();
export const mouse = new THREE.Vector2();

export function setEditMode(v) { inputState.editMode = v; }

export function resetAutoRotate() {
    clearTimeout(inputState.inactivityTimer);
    const checkAndEnable = () => {
        if (!inputState.editMode) {
            inputState.autoRotate = true;
        } else {
            inputState.inactivityTimer = setTimeout(checkAndEnable, 1000);
        }
    };
    inputState.inactivityTimer = setTimeout(checkAndEnable, 3000);
}

export function setKnob(knob, dx, dy) {
    if (!knob) return;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
}

export function resetKnob(knob) {
    if (!knob) return;
    knob.style.transition = 'transform 150ms ease-out';
    knob.style.transform = 'translate(0, 0)';
    setTimeout(() => knob.style.transition = '', 160);
}

export function setButtonActive(el, active) {
    if (!el) return;
    el.classList.toggle('active', active);
}

export function getDist(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
}

// Pinch zoom state
let pinchStartDist = null;

export function initInput() {
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
        if (inputState.editMode) {
            if (event.button === 0) {
                inputState.isDragging = true;
                inputState.lastMouseX = event.clientX;
                inputState.lastMouseY = event.clientY;
                inputState.autoRotate = false;
            }
            if (event.button === 1 || event.button === 2) {
                event.preventDefault();
                inputState.isMiddleDragging = true;
                inputState.lastMouseX = event.clientX;
                inputState.lastMouseY = event.clientY;
                inputState.autoRotate = false;
                return;
            }
            return;
        }

        if (event.button === 0) {
            inputState.isDragging = true;
            inputState.lastMouseX = event.clientX;
            inputState.lastMouseY = event.clientY;
            inputState.autoRotate = false;
        } else if (event.button === 1 || event.button === 2) {
            event.preventDefault();
            inputState.isMiddleDragging = true;
            inputState.lastMouseX = event.clientX;
            inputState.lastMouseY = event.clientY;
            inputState.autoRotate = false;
        }
    });

    document.addEventListener('mouseup', () => {
        inputState.isDragging = false;
        inputState.isMiddleDragging = false;
    });

    document.addEventListener('mousemove', (event) => {
        if (inputState.isDragging) {
            const deltaX = event.clientX - inputState.lastMouseX;
            const deltaY = event.clientY - inputState.lastMouseY;

            inputState.targetOrbitAngle -= deltaX * 0.008;
            inputState.targetOrbitHeight += deltaY * 0.15;
            inputState.targetOrbitHeight = Math.max(-20, Math.min(35, inputState.targetOrbitHeight));

            inputState.lastMouseX = event.clientX;
            inputState.lastMouseY = event.clientY;
        } else if (inputState.isMiddleDragging) {
            const deltaX = event.clientX - inputState.lastMouseX;
            const deltaY = event.clientY - inputState.lastMouseY;

            const right = new THREE.Vector3(
                Math.cos(inputState.currentOrbitAngle),
                0,
                -Math.sin(inputState.currentOrbitAngle)
            );

            const panSpeed = 0.08;
            inputState.targetX += right.x * deltaX * panSpeed;
            inputState.targetZ += right.z * deltaX * panSpeed;
            inputState.targetY -= deltaY * panSpeed;

            inputState.lastMouseX = event.clientX;
            inputState.lastMouseY = event.clientY;
        }
    });

    document.addEventListener('wheel', (event) => {
        if (inputState.editMode) return;
        event.preventDefault();
        const zoomDelta = event.deltaY * 0.03;
        inputState.targetOrbitRadius += zoomDelta;
        inputState.targetOrbitRadius = Math.max(15, Math.min(100, inputState.targetOrbitRadius));
    }, { passive: false });

    const leftStick = document.getElementById('leftStick');
    const rightStick = document.getElementById('rightStick');
    const leftKnob = leftStick && leftStick.querySelector('.stick-knob');
    const rightKnob = rightStick && rightStick.querySelector('.stick-knob');

    function handleTouchStart(e) {
        resetAutoRotate();
        for (const t of Array.from(e.changedTouches)) {
            const target = document.elementFromPoint(t.clientX, t.clientY);
            if (leftStick && (target === leftStick || leftStick.contains(target))) {
                mobile.leftTouchId = t.identifier;
                mobile.leftStart = { x: t.clientX, y: t.clientY };
                mobile.leftPos = { x: 0, y: 0 };
            }
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
                inputState.targetOrbitAngle -= dx * 0.008;
                inputState.targetOrbitHeight += dy * 0.12;
                inputState.targetOrbitHeight = Math.max(-20, Math.min(35, inputState.targetOrbitHeight));
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

    function handleTouchMovePinch(e) {
        if (e.touches.length === 2) {
            const d = getDist(e.touches[0], e.touches[1]);
            if (pinchStartDist == null) pinchStartDist = d;
            const delta = d - pinchStartDist;
            inputState.targetOrbitRadius -= delta * 0.03;
            inputState.targetOrbitRadius = Math.max(15, Math.min(100, inputState.targetOrbitRadius));
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
        if (e.touches.length === 2) {
            pinchStartDist = getDist(e.touches[0], e.touches[1]);
        }
        resetAutoRotate();
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            handleTouchMovePinch(e);
        }
        if (e.touches.length >= 1) e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        handleTouchEnd(e);
        handleTouchEndPinch(e);
    }, { passive: true });

    const btnUp = document.getElementById('btnUp');
    const btnDown = document.getElementById('btnDown');

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

    document.addEventListener('contextmenu', (e) => e.preventDefault());
}

    // --- Renderer / gizmo binding: allow input module to handle gizmo pointer events ---
    let _archRenderer = null;
    let _cameraRef = null;
    let _rendererRef = null;
    let _getEditMode = null;
    let _getSelectedNode = null;
    let _onGizmoMove = null;
    let _onGizmoUp = null;
    let _onSelect = null;
    let _onDeselect = null;
    let _gizmoHandlersAttached = false;

    export function bindRenderer({ archRenderer, camera, renderer, getEditMode, getSelectedNode, onGizmoMove, onGizmoUp, onSelect, onDeselect } = {}) {
        _archRenderer = archRenderer || null;
        _cameraRef = camera || null;
        _rendererRef = renderer || null;
        _getEditMode = getEditMode || null;
        _getSelectedNode = getSelectedNode || null;
        _onGizmoMove = onGizmoMove || null;
        _onGizmoUp = onGizmoUp || null;
        _onSelect = onSelect || null;
        _onDeselect = onDeselect || null;

        if (_gizmoHandlersAttached) return;

        function _gizmoPointerDown(e) {
            try {
                if (!_getEditMode || !_getEditMode()) return;
                if (e.button !== 0) return;
                if (!_rendererRef || !_cameraRef || !_archRenderer) return;
                const rect = _rendererRef.domElement.getBoundingClientRect();
                mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                raycaster.setFromCamera(mouse, _cameraRef);
                const axis = _archRenderer.gizmoPointerDown(raycaster);
                if (axis) {
                    document.body.style.cursor = 'grabbing';
                    inputState.isDragging = false;
                    inputState.isMiddleDragging = false;
                    e.preventDefault();
                    return;
                }
            } catch (err) { /* ignore */ }
        }

        // Selection handler: click in edit mode selects/deselects nodes
        function _selectHandler(e) {
            try {
                // allow selection on left-click (ignore clicks on UI); edit mode may be toggled by UI when a selection occurs
                if (e.button !== undefined && e.button !== 0) return; // only left click
                // ignore clicks on UI
                if (e.target && (e.target.closest && (e.target.closest('.ui-container') || e.target.closest('.panel-box') || e.target.closest('.button')))) return;
                if (!_rendererRef || !_cameraRef || !_archRenderer) return;
                // if user is dragging gizmo, ignore select
                if (_archRenderer.axisDragging) return;

                const rect = _rendererRef.domElement.getBoundingClientRect();
                mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                raycaster.setFromCamera(mouse, _cameraRef);
                const intersects = raycaster.intersectObjects(_archRenderer.nodes, true);
                if (intersects && intersects.length) {
                    let obj = intersects[0].object;
                    while (obj && !_archRenderer.nodes.includes(obj)) {
                        obj = obj.parent;
                    }
                    const resolved = obj || (intersects[0].object && intersects[0].object.parent) || null;
                    if (resolved) {
                        const selId = resolved.userData && resolved.userData.id ? resolved.userData.id : null;
                        const sceneNode = selId ? _archRenderer.getSceneNodeById(selId) : resolved;
                        if (_onSelect) try { _onSelect(selId, sceneNode); } catch (ee) {}
                        // only show gizmo when edit mode is active (edit mode must be toggled by the Edit button)
                        try { if (_getEditMode && _getEditMode()) _archRenderer.showGizmoAt(sceneNode); } catch (ee) {}
                        return;
                    }
                }
                // nothing hit -> deselect
                if (_onDeselect) try { _onDeselect(); } catch (ee) {}
                try { _archRenderer.hideGizmo(); } catch (ee) {}
            } catch (err) { /* ignore */ }
        }

        function _gizmoPointerMove(e) {
            try {
                if (!_getEditMode || !_getEditMode()) return;
                if (!_rendererRef || !_cameraRef || !_archRenderer) return;
                const rect = _rendererRef.domElement.getBoundingClientRect();
                mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                raycaster.setFromCamera(mouse, _cameraRef);
                const selectedNode = _getSelectedNode ? _getSelectedNode() : null;
                const closest = _archRenderer.gizmoPointerMove(raycaster, selectedNode);
                if (closest) {
                    try { if (_onGizmoMove) _onGizmoMove(selectedNode); } catch (e) {}
                }
            } catch (err) { /* ignore */ }
        }

        function _gizmoPointerUp(e) {
            try {
                if (!_archRenderer) return;
                _archRenderer.gizmoPointerUp();
                document.body.style.cursor = 'default';
                if (_onGizmoUp) try { _onGizmoUp(); } catch (e) {}
            } catch (err) { /* ignore */ }
        }

        document.addEventListener('mousedown', _gizmoPointerDown);
        document.addEventListener('mousemove', _gizmoPointerMove);
        document.addEventListener('mouseup', _gizmoPointerUp);
        // attach selection handler (separate so it doesn't interfere with gizmo drag)
        document.addEventListener('click', _selectHandler);
        _gizmoHandlersAttached = true;
    }