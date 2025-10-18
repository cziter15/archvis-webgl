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
		this.model = ArchModel.createObservable(ArchModel.createEmpty());
		this.ui = null;
		this.renderer = null;
		this.input = null;
	}

	init() {
		// create observable model first so renderer/ui/input subscribe to the right instance
		this.model = ArchModel.createObservable(ArchModel.createRoot());
		const canvas = document.getElementById('canvas');
		this.renderer = new ArchRenderer(this, canvas);
		this.ui = new UI(this);
		this.input = new InputHandler(this, this.renderer);
		// let renderer and ui react to model events (they subscribe themselves)
		// emit an initial rebuild so renderer and UI can sync
		if (this.model && typeof this.model.emitChange === 'function') this.model.emitChange({ type: 'rebuild' });
		this.renderer.startLoop(this.input.inputState, this.input.keys, this.input.mobile);
		this.ui.updateLegendDisplay();
	}

	selectNode(id, sceneNode) {
		// only update model selection; renderer and ui handle visuals
		if (this.model && typeof this.model.setSelected === 'function') this.model.setSelected(id);
	}

	deselectNode() {
		if (this.model && typeof this.model.setSelected === 'function') this.model.setSelected(null);
	}


}