// Architecture XML utilities (extracted from main.js)
export class ArchitectureXML {
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
