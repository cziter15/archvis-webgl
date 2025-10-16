// ArchModel: responsible for holding and manipulating the architecture data model
export class ArchModel {
    constructor(initial = null) {
        if (initial) {
            this.architecture = initial;
        } else {
            this.architecture = {
                root: { name: 'Empty Architecture', pos: [0, 0, 0], color: '#666666', scale: 1, children: [] },
                legend: [],
                uiInfo: { title: '' }
            };
        }
    }

    get() {
        return this.architecture;
    }

    set(arch) {
        this.architecture = arch;
    }

    // utility: assign ids recursively
    assignIdsRecursively(node) {
        if (!node) return;
        if (!node.id) node.id = (Math.random().toString(36).slice(2, 9));
        if (node.children) node.children.forEach(child => this.assignIdsRecursively(child));
    }

    // find node by id (DFS)
    findNodeById(node, id) {
        if (!node) return null;
        if (node.id && node.id === id) return node;
        if (node.children) {
            for (const c of node.children) {
                const found = this.findNodeById(c, id);
                if (found) return found;
            }
        }
        return null;
    }

    // map legacy color attributes to legend categories when possible
    mapColorsToLegend(node, legend) {
        if (!node) return;
        if (!node.category && node.color && legend && legend.length) {
            const found = legend.find(e => e.color && e.color.toLowerCase() === node.color.toLowerCase());
            if (found) { node.category = found.id; delete node.color; }
        }
        if (node.children) node.children.forEach(c => this.mapColorsToLegend(c, legend));
    }

    // rename node by id (returns true if renamed)
    renameNodeById(node, id, newName) {
        if (!node) return false;
        if (node.id && node.id === id) { node.name = newName; return true; }
        if (node.children) {
            for (const c of node.children) {
                if (this.renameNodeById(c, id, newName)) return true;
            }
        }
        return false;
    }

    // delete a child node by id (not root). Returns true on success
    deleteNodeById(parent, id) {
        if (!parent || !parent.children) return false;
        const idx = parent.children.findIndex(c => c.id === id);
        if (idx !== -1) {
            parent.children.splice(idx, 1);
            return true;
        }
        for (const c of parent.children) {
            if (this.deleteNodeById(c, id)) return true;
        }
        return false;
    }
}

// convenience exported functions for procedural usage
export function findNodeById(node, id) {
    const model = new ArchModel();
    return model.findNodeById(node, id);
}
export function assignIdsRecursively(node) {
    const model = new ArchModel();
    return model.assignIdsRecursively(node);
}
export function mapColorsToLegend(node, legend) {
    const model = new ArchModel();
    return model.mapColorsToLegend(node, legend);
}
export function renameNodeById(node, id, newName) {
    const model = new ArchModel();
    return model.renameNodeById(node, id, newName);
}
export function deleteNodeById(parent, id) {
    const model = new ArchModel();
    return model.deleteNodeById(parent, id);
}
