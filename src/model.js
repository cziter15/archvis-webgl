/*
 *	Copyright (c) 2025-2026, Krzysztof Strehlau
 *
 *	This file is a part of the ArchVis WebGL utility.
 *	All licensing information can be found inside LICENSE.md file.
 *
 *	https://github.com/cziter15/archvis-webgl/blob/main/LICENSE
 */
import * as THREE from 'three';

export class ArchModel {
  static assignIds(node) {
    if (!node) return;
    node.id ||= Math.random().toString(36).slice(2, 9);
    node.children?.forEach(c => this.assignIds(c));
  }

  static findById(node, id) {
    if (!node) return null;
    if (node.id === id) return node;
    return node.children?.reduce((found, child) => found || this.findById(child, id), null) || null;
  }

  static deleteById(parent, id) {
    if (!parent?.children) return false;
    const idx = parent.children.findIndex(c => c.id === id);
    if (idx !== -1) { parent.children.splice(idx, 1); return true; }
    return parent.children.some(child => this.deleteById(child, id));
  }

  static getColor(node, legend) {
    if (node?.category) {
      const entry = legend?.find(e => e.id === node.category);
      if (entry?.color) return entry.color;
    }
    return node?.color || '#666666';
  }

  static mapColorsToLegend(node, legend) {
    if (!node || !legend?.length) return;
    if (node.category && !node.color) {
      const entry = legend.find(e => e.id === node.category);
      if (entry?.color) node.color = entry.color;
    } else if (!node.category && node.color) {
      const found = legend.find(e => e.color?.toLowerCase() === node.color.toLowerCase());
      if (found) node.category = found.id;
    }
    node.children?.forEach(c => this.mapColorsToLegend(c, legend));
  }

  static toXml(arch) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<arch>\n';
    xml += this._nodeToXml(arch.root, 2);
    if (arch.legend?.length) {
      xml += '  <legend>\n';
      arch.legend.forEach(e => { xml += `    <entry id="${e.id}" name="${e.name}" color="${e.color}" />\n`; });
      xml += '  </legend>\n';
    }
    if (arch.uiInfo?.title) {
      xml += '  <ui-info>\n';
      xml += `    <title>${arch.uiInfo.title}</title>\n`;
      xml += '  </ui-info>\n';
    }
    xml += '</arch>';
    return xml;
  }

  static _nodeToXml(node, indent) {
    const spaces = ' '.repeat(indent);
    const attrs = [ `name="${node.name}"`, `pos="${node.pos.join(',')}"`, node.id && `id="${node.id}"`, node.category ? `category="${node.category}"` : node.color && `color="${node.color}"`, node.scale !== undefined && `scale="${node.scale}"` ].filter(Boolean).join(' ');
    if (node.children?.length) {
      let xml = `${spaces}<node ${attrs}>\n`;
      node.children.forEach(c => { xml += this._nodeToXml(c, indent + 2); });
      return xml + `${spaces}</node>\n`;
    }
    return `${spaces}<node ${attrs} />\n`;
  }

  static fromXml(xmlString) {
    try {
      const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
      if (doc.getElementsByTagName('parsererror')?.length) throw new Error('XML parse error');
      const rootEl = doc.querySelector('arch > node');
      if (!rootEl) throw new Error('No root node found');
      const root = this._parseNode(rootEl);
      const legend = Array.from(doc.querySelectorAll('arch > legend > entry')).map(el => ({ id: el.getAttribute('id') || Math.random().toString(36).slice(2, 9), name: el.getAttribute('name'), color: el.getAttribute('color') }));
      const uiInfo = { title: '' };
      const titleEl = doc.querySelector('arch > ui-info > title'); if (titleEl) uiInfo.title = titleEl.textContent;
      return { root, legend, uiInfo };
    } catch (error) { console.error('XML parsing error:', error); throw error; }
  }

  static _parseNode(el) {
    const node = { id: el.getAttribute('id') || Math.random().toString(36).slice(2, 9), name: el.getAttribute('name'), pos: [0, 0, 0], children: [] };
    const scale = el.getAttribute('scale'); if (scale) node.scale = parseFloat(scale);
    const category = el.getAttribute('category'); if (category) node.category = category; else { const color = el.getAttribute('color'); if (color) node.color = color; }
    const posAttr = el.getAttribute('pos'); if (posAttr) { const parts = posAttr.split(',').map(p => parseFloat(p)); if (parts.length === 3 && parts.every(p => !Number.isNaN(p))) node.pos = parts; }
    for (let i = 0; i < el.childNodes.length; i++) { const child = el.childNodes[i]; if (child.nodeType === 1 && child.tagName.toLowerCase() === 'node') node.children.push(this._parseNode(child)); }
    return node;
  }

  static createEmpty() { return { root: { name: 'Empty Architecture', pos: [0, 0, 0], scale: 1, children: [] }, legend: [], uiInfo: { title: 'ARCHITECTURE VISUALIZATION' } }; }

  static createRoot() { return { root: { name: 'root', pos: [0, 0, 0], scale: 1, children: [] }, legend: [], uiInfo: { title: 'ARCHITECTURE VISUALIZATION' } }; }

  static createSample() {
    return this.fromXml(`<?xml version="1.0" encoding="UTF-8"?>
<arch>
  <node name="ROOT" pos="0,0,0" scale="1">
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
    <entry id="legend-core" name="Core Services" color="#00ffff" />
    <entry id="legend-modules" name="Modules" color="#ff00ff" />
    <entry id="legend-components" name="Components" color="#ffff00" />
    <entry id="legend-data" name="Data Layer" color="#00ff00" />
  </legend>
  <ui-info><title>MICROSERVICES ARCHITECTURE</title></ui-info>
</arch>`);
  }

  static createObservable(model) {
    if (!model) model = this.createEmpty();
    if (model.__isObservable) return model;
    model.__isObservable = true;
    model._changeListeners = new Set();
    model._selectListeners = new Set();
    model._debounceTimers = new Map();
    model._lastDebouncePayload = new Map();
    model.onChange = (fn) => model._changeListeners.add(fn);
    model.offChange = (fn) => model._changeListeners.delete(fn);
    model.emitChange = (payload) => { model._changeListeners.forEach(fn => { try { fn(payload); } catch (e) { console.error('change listener error', e); } }); };
    model.onSelect = (fn) => model._selectListeners.add(fn);
    model.offSelect = (fn) => model._selectListeners.delete(fn);
    model.emitSelect = (id) => { model._selectListeners.forEach(fn => { try { fn(id); } catch (e) { console.error('select listener error', e); } }); };
    model.setSelected = (id) => { model.selected = id; model.emitSelect(id); };
    model.getSelected = () => model.selected || null;
    model.update = (updater, payload = { type: 'rebuild' }, opts = {}) => {
      try {
        if (typeof updater === 'function') updater(model);
        const debounceMs = opts.debounceMs || 0;
        if (!debounceMs) { model.emitChange(payload); return; }
        const key = payload && payload.type ? payload.type : '__default';
        model._lastDebouncePayload.set(key, payload);
        const prev = model._debounceTimers.get(key);
        if (prev) clearTimeout(prev);
        const t = setTimeout(() => { const p = model._lastDebouncePayload.get(key) || payload; model._debounceTimers.delete(key); model._lastDebouncePayload.delete(key); model.emitChange(p); }, debounceMs);
        model._debounceTimers.set(key, t);
      } catch (e) { console.error('model.update error', e); }
    };
    return model;
  }

}