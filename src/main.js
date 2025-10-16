import { App } from './app.js';
/*
 *	Copyright (c) 2025-2026, Krzysztof Strehlau
 *
 *	This file is a part of the ArchVis WebGL utility.
 *	All licensing information can be found inside LICENSE.md file.
 *
 *	https://github.com/cziter15/archvis-webgl/blob/main/LICENSE
 */

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  window.mainApp = app;
  app.init();
});