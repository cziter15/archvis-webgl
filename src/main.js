import MainApp from './app.js';

// Minimal bootstrap: MainApp handles creating renderer, input, UI and starting the loop.
document.addEventListener('DOMContentLoaded', () => {
	const app = new MainApp();
	window.mainApp = app;
	try { app.init(); } catch (e) { console.warn('MainApp.init failed', e); }
});
