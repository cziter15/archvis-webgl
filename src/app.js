/*
 *	Copyright (c) 2025-2026, Krzysztof Strehlau
 *
 *	This file is a part of the ArchVis WebGL utility.
 *	All licensing information can be found inside LICENSE.md file.
 *
 *	https://github.com/cziter15/archvis-webgl/blob/main/LICENSE
 */

import {
	ArchModel
} from './model.js';
import {
	ArchRenderer
} from './renderer.js';
import {
	UI
} from './ui.js';
import {
	InputHandler
} from './input.js';

export class App {
	constructor() {
		this.model = ArchModel.createEmpty();
		this.selectedNode = null;
		this.ui = null;
		this.renderer = null;
		this.input = null;
	}

	init() {
		const canvas = document.getElementById('canvas');
		this.renderer = new ArchRenderer(this, canvas);
		this.ui = new UI(this);
		this.input = new InputHandler(this, this.renderer);

		this.ui.wireAll();
		this.loadSample();

		this.updateTitle();
	}

	selectNode(id, sceneNode) {
		this.selectedNode = sceneNode;
		if (this.ui.editMode) {
			this.renderer.showGizmoAt(sceneNode);
			this.ui.populateEditPanel();
		}
	}

	deselectNode() {
		this.selectedNode = null;
		this.renderer.hideGizmo();
		// Show empty edit panel when in edit mode but no node is selected
		if (this.ui.editMode) {
			this.ui.renderEmptyEditPanel();
		} else {
			this.ui.populateEditPanel();
		}
	}

	rebuild() {
		ArchModel.assignIds(this.model.root);
		this.model.legend?.forEach(e => {
			if (!e.id) e.id = Math.random().toString(36).slice(2, 9);
		});
		ArchModel.mapColorsToLegend(this.model.root, this.model.legend);

		const prevId = this.selectedNode?.userData?.id;
		const found = this.renderer.buildFromArch(this.model, prevId);
		this.selectedNode = found;

		this.ui.updateLegendDisplay();


		this.updateTitle();

		if (this.ui.editMode) {
			this.ui.renderLegendEditor();
		}
	}

	updateTitle() {
		const titleEl = document.getElementById('title');

		if (titleEl) {
			const titleText = this.model.uiInfo?.title || 'ARCHITECTURE VISUALIZATION';
			titleEl.textContent = titleText;
		}
	}

	loadSample() {
		this.model = ArchModel.createSample();
		this.rebuild();
		this.renderer.startLoop(this.input.inputState, this.input.keys, this.input.mobile);
		this.ui.addMessage('Sample loaded');
	}

	onFrameUpdate() {
		this.ui.updateEditPanelValues();
	}
}