// ArchModel utilities: functions for manipulating architecture data model

// Shared architecture state (holds currently-loaded architecture)
export let architecture = {
    root: { name: 'Empty Architecture', pos: [0,0,0], color: '#666666', scale: 1, children: [] },
    legend: [],
    uiInfo: { title: '' }
};

export function getArchitecture() { return architecture; }
export function setArchitecture(arch) { architecture = arch; }

// utility: assign ids recursively
export function assignIdsRecursively(node) {
    if (!node) return;
    if (!node.id) node.id = (Math.random().toString(36).slice(2, 9));
    if (node.children) node.children.forEach(child => assignIdsRecursively(child));
}

// find node by id (DFS)
export function findNodeById(node, id) {
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

// map legacy color attributes to legend categories when possible
export function mapColorsToLegend(node, legend) {
    if (!node) return;
    if (!node.category && node.color && legend && legend.length) {
        const found = legend.find(e => e.color && e.color.toLowerCase() === node.color.toLowerCase());
        if (found) { node.category = found.id; delete node.color; }
    }
    if (node.children) node.children.forEach(c => mapColorsToLegend(c, legend));
}

// rename node by id (returns true if renamed)
export function renameNodeById(node, id, newName) {
    if (!node) return false;
    if (node.id && node.id === id) { node.name = newName; return true; }
    if (node.children) {
        for (const c of node.children) {
            if (renameNodeById(c, id, newName)) return true;
        }
    }
    return false;
}

// delete a child node by id (not root). Returns true on success
export function deleteNodeById(parent, id) {
    if (!parent || !parent.children) return false;
    const idx = parent.children.findIndex(c => c.id === id);
    if (idx !== -1) {
        parent.children.splice(idx, 1);
        return true;
    }
    for (const c of parent.children) {
        if (deleteNodeById(c, id)) return true;
    }
    return false;
}

// resolve color for an architecture node object: prefer category -> legend color, then explicit color, then default
export function getColorForArchNode(node, legend) {
    if (!node) return '#666666';
    if (node.category) {
        const found = (legend || []).find(e => e.id === node.category || e.name === node.category);
        if (found && found.color) return found.color;
    }
    if (node.color) return node.color;
    return '#666666';
}

// update node position from scene node
export function updateNodePositionFromScene(root, id, sceneNode) {
    const archNode = findNodeById(root, id);
    if (archNode) {
        archNode.pos = [sceneNode.position.x, sceneNode.position.y, sceneNode.position.z];
    } else if (root && root.id === id) {
        root.pos = [sceneNode.position.x, sceneNode.position.y, sceneNode.position.z];
    }
}

// add child to parent
export function addChild(root, parentId, newNode) {
    const parent = parentId ? findNodeById(root, parentId) : root;
    if (!parent) return false;
    if (!parent.children) parent.children = [];
    parent.children.push(newNode);
    return true;
}
