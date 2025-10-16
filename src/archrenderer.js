// ArchRenderer: encapsulates Three.js scene and rendering operations
// Responsibilities:
// - create and manage Three.js Scene, Camera, Renderer
// - create/keep track of node and line meshes
// - provide methods to rebuild scene from architecture model
// - expose an animate/update method to be called from main loop

export class ArchRenderer {
    constructor({ mountElement, colorResolver = null, width = window.innerWidth, height = window.innerHeight } = {}) {
        this.mountElement = mountElement || document.getElementById('canvas');
        this.colorResolver = colorResolver || (() => '#666666');

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000510, 0.008);

        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        this.camera.position.set(0, 15, 50);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setClearColor(0x000510);
        if (this.mountElement) this.mountElement.appendChild(this.renderer.domElement);

        // lighting
        const ambientLight = new THREE.AmbientLight(0x1a1a3e, 0.8);
        this.scene.add(ambientLight);

        const pointLight1 = new THREE.PointLight(0x00ffff, 1.5, 60);
        pointLight1.position.set(15, 15, 15);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xff00ff, 1.5, 60);
        pointLight2.position.set(-15, 10, -15);
        this.scene.add(pointLight2);

        const pointLight3 = new THREE.PointLight(0xffffff, 1, 40);
        pointLight3.position.set(0, 20, 0);
        this.scene.add(pointLight3);

        const gridHelper = new THREE.GridHelper(100, 100, 0x00ffff, 0x0a0a2e);
        gridHelper.position.y = -18;
        this.scene.add(gridHelper);

        // particle field
        this.nodes = [];
        this.lines = [];

        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = 1500;
        const positions = new Float32Array(particlesCount * 3);
        for (let i = 0; i < particlesCount * 3; i++) positions[i] = (Math.random() - 0.5) * 100;
        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particlesMaterial = new THREE.PointsMaterial({ size: 0.05, color: 0x00ffff, transparent: true, opacity: 0.6 });
        this.particles = new THREE.Points(particlesGeometry, particlesMaterial);
        this.scene.add(this.particles);

        // exposed state used by main.js animation loop (kept here for SRP)
        this.frame = 0;
        // gizmo state (for node editing)
        this.gizmoGroup = null;
        this.axisDragging = null; // 'x'|'y'|'z' or null
        this.axisDragStart = null;
    }

    // --- Gizmo utilities: create, show/hide, and pointer handling ---
    createGizmo() {
        if (this.gizmoGroup) return this.gizmoGroup;
        const gizmoGroup = new THREE.Group();
        const shaftGeom = new THREE.CylinderGeometry(0.06, 0.06, 1, 8);
        const coneGeom = new THREE.ConeGeometry(0.12, 0.2, 8);

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

        const matY = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const shaftY = new THREE.Mesh(shaftGeom, matY);
        shaftY.position.y = 0.5;
        const coneY = new THREE.Mesh(coneGeom, matY);
        coneY.position.y = 1.05;
        const groupY = new THREE.Group();
        groupY.add(shaftY);
        groupY.add(coneY);
        groupY.userData = { axis: 'y' };

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
        this.scene.add(gizmoGroup);
        this.gizmoGroup = gizmoGroup;
        return gizmoGroup;
    }

    showGizmoAt(node) {
        if (!node) return;
        this.createGizmo();
        this.gizmoGroup.position.copy(node.position);
        this.gizmoGroup.visible = true;
    }

    hideGizmo() {
        if (!this.gizmoGroup) return;
        this.gizmoGroup.visible = false;
    }

    updateGizmoPosition(node) {
        if (!this.gizmoGroup || !node) return;
        this.gizmoGroup.position.copy(node.position);
    }

    // Helper: compute closest point on axis line to a ray
    _closestPointOnAxisToRay(ray, axisOrigin, axisDir) {
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

    // Called when pointer down occurs; raycaster should be already set
    gizmoPointerDown(raycaster) {
        if (!this.gizmoGroup || !this.gizmoGroup.visible) return null;
        const picks = raycaster.intersectObjects(this.gizmoGroup.children, true);
        if (picks && picks.length) {
            let picked = picks[0].object;
            while (picked && !picked.userData.axis) picked = picked.parent;
            if (picked && picked.userData && picked.userData.axis) {
                this.axisDragging = picked.userData.axis;
                this.axisDragStart = this._closestPointOnAxisToRay(raycaster.ray, this.gizmoGroup.position.clone(), new THREE.Vector3(this.axisDragging === 'x' ? 1 : 0, this.axisDragging === 'y' ? 1 : 0, this.axisDragging === 'z' ? 1 : 0));
                return this.axisDragging;
            }
        }
        return null;
    }

    // Called during pointer move while dragging an axis; selectedNode is a THREE.Object3D
    gizmoPointerMove(raycaster, selectedNode) {
        if (!this.axisDragging || !selectedNode) return null;
        const axisDir = new THREE.Vector3(this.axisDragging === 'x' ? 1 : 0, this.axisDragging === 'y' ? 1 : 0, this.axisDragging === 'z' ? 1 : 0);
        const closest = this._closestPointOnAxisToRay(raycaster.ray, this.gizmoGroup.position.clone(), axisDir);
        if (closest) {
            selectedNode.position.copy(closest);
            this.updateGizmoPosition(selectedNode);
            return closest;
        }
        return null;
    }

    // End pointer dragging
    gizmoPointerUp() {
        if (this.axisDragging) {
            this.axisDragging = null;
            this.axisDragStart = null;
        }
    }

    // create a text mesh (copied from previous implementation)
    createTextMesh(text, color) {
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
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthTest: true });

        const textMesh = new THREE.Mesh(geometry, material);

        const backGeometry = new THREE.PlaneGeometry(4.6, 0.66);
        const backMaterial = new THREE.MeshBasicMaterial({ color: 0x000510, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
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

    createNode(name, position, color, scale = 1, id = null) {
        const group = new THREE.Group();
        const rotatingGroup = new THREE.Group();

        const geometry = new THREE.BoxGeometry(0.6 * scale, 0.6 * scale, 0.6 * scale);
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
        const cube = new THREE.LineSegments(edges, lineMaterial);
        rotatingGroup.add(cube);

        const glowGeometry = new THREE.BoxGeometry(0.4 * scale, 0.4 * scale, 0.4 * scale);
        const glowMaterial = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.3, wireframe: true });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        rotatingGroup.add(glow);

        const light = new THREE.PointLight(color, 0.5, 5);
        rotatingGroup.add(light);

        group.add(rotatingGroup);

        try {
            const textMesh = this.createTextMesh(name, color);
            textMesh.position.y = 1.5 * scale;
            group.add(textMesh);
        } catch (error) {
            console.warn('Failed to create text mesh:', error);
        }

        group.position.set(...position);
        const uid = id || (Math.random().toString(36).slice(2, 9));
        group.userData = { id: uid, name, rotationSpeed: Math.random() * 0.01 + 0.005, rotatingGroup };

        this.scene.add(group);
        this.nodes.push(group);

        return group;
    }

    createLineWithIds(start, end, color, startId = null, endId = null, opacity = 0.5) {
        const points = [ new THREE.Vector3(...start), new THREE.Vector3(...end) ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity });
        const line = new THREE.Line(geometry, material);
        line.userData = { startId, endId };
        this.scene.add(line);
        this.lines.push(line);
        return line;
    }

    getSceneNodeById(id) {
        return this.nodes.find(n => n.userData && n.userData.id === id) || null;
    }

    createChildNodes(children, parentNode, parentPos, parentColor, colorForNode) {
        children.forEach(child => {
            if (child.name) {
                const childColor = colorForNode ? colorForNode(child) : this.colorResolver(child);
                const childNode = this.createNode(child.name, child.pos, childColor, child.scale || 1, child.id || null);
                const parentId = parentNode && parentNode.userData ? parentNode.userData.id : null;
                this.createLineWithIds(parentPos, child.pos, parentColor, parentId, child.id || null);

                if (child.children && child.children.length > 0) {
                    this.createChildNodes(child.children, childNode, child.pos, childColor, colorForNode);
                }
            }
        });
    }

    updateSceneNodeColor(sceneNode, colorHex) {
        if (!sceneNode || !colorHex) return;
        try {
            const rg = sceneNode.userData && sceneNode.userData.rotatingGroup;
            if (rg && rg.children) {
                rg.children.forEach(c => {
                    if (c.material && c.material.color) c.material.color.set(colorHex);
                    if (c.isPointLight || c.type === 'PointLight') c.color && c.color.set && c.color.set(colorHex);
                });
            }
            sceneNode.children.forEach(child => {
                if (child.type === 'Group') {
                    child.children.forEach(ch => {
                        if (ch.material && ch.material.color) ch.material.color.set(colorHex);
                    });
                }
            });
        } catch (e) {
            console.warn('Failed to update scene node color', e);
        }
    }

    // rebuilds scene from an architecture object; preserves previously-selected id mapping if provided
    rebuildScene(architecture, prevSelectedId = null) {
        this.nodes.forEach(node => this.scene.remove(node));
        this.lines.forEach(line => this.scene.remove(line));
        this.nodes.length = 0;
        this.lines.length = 0;

        if (architecture.root && architecture.root.name && architecture.root.name !== 'Empty Architecture') {
            if (!architecture.root.id) architecture.root.id = (Math.random().toString(36).slice(2, 9));
            const rootColor = this.colorResolver ? this.colorResolver(architecture.root) : '#666666';
            const rootNode = this.createNode(architecture.root.name, architecture.root.pos, rootColor, architecture.root.scale, architecture.root.id);
            if (architecture.root.children && architecture.root.children.length > 0) {
                this.createChildNodes(architecture.root.children, rootNode, architecture.root.pos, rootColor, null);
            }
        }

        // find and return selected node (if prevSelectedId present)
        if (prevSelectedId) {
            const found = this.getSceneNodeById(prevSelectedId);
            return found || null;
        }
        return null;
    }

    // update loop part specific to renderer (animate internal properties like particles and rotate nodes)
    update(frame) {
        this.frame = frame;
        this.nodes.forEach(node => {
            if (node.userData && node.userData.rotatingGroup) {
                node.userData.rotatingGroup.rotation.y += node.userData.rotationSpeed;
                node.userData.rotatingGroup.rotation.x += node.userData.rotationSpeed * 0.5;
            }
        });

        this.lines.forEach((line, i) => {
            line.material.opacity = 0.3 + Math.sin(frame * 0.05 + i) * 0.2;
            if (line.userData && (line.userData.startId || line.userData.endId)) {
                const startNode = line.userData.startId ? this.getSceneNodeById(line.userData.startId) : null;
                const endNode = line.userData.endId ? this.getSceneNodeById(line.userData.endId) : null;
                if (startNode || endNode) {
                    const posAttr = line.geometry.attributes.position;
                    const arr = posAttr.array;
                    if (startNode) {
                        arr[0] = startNode.position.x; arr[1] = startNode.position.y; arr[2] = startNode.position.z;
                    }
                    if (endNode) {
                        arr[3] = endNode.position.x; arr[4] = endNode.position.y; arr[5] = endNode.position.z;
                    }
                    posAttr.needsUpdate = true;
                    line.geometry.computeBoundingSphere();
                }
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

    resize(width = window.innerWidth, height = window.innerHeight) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
}
