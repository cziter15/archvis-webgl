# 🖥️ ArchVis WebGL
[![GitHub Pages](https://github.com/cziter15/archvis-webgl/actions/workflows/pages.yml/badge.svg)](https://cziter15.github.io/archvis-webgl/) [![Lines of Code](https://img.shields.io/endpoint?color=blue&url=https://ghloc.vercel.app/api/cziter15/archvis-webgl/badge?filter=.html$,.js$,.css$)](https://github.com/cziter15/archvis-webgl)

> **ArchVis WebGL** is a small interactive WebGL-based architecture visualization built with Three.js and Vite.<br>
> Initialy vibe-coded with Claude 4.5 and GLM 4.5, then moved manually into Vite-based solution.
>
> It loads and saves architectures as XML and provides a 3D view with of it.<br>
> A sample architecture file is included for quick demos.

<img alt="image" src="https://github.com/user-attachments/assets/30810f79-1093-4cf1-a379-dcf9584f0b2f" />

## ▶️ Quick start

Prerequisites: Node.js (16+) and npm installed.

1. Install dependencies

```powershell
npm install
```

2. Start the dev server

```powershell
npm run dev
```

3. Open the app in your browser (Vite will show the URL, commonly `http://localhost:5173`).

## 🧩 Usage 

- Click the `Load` button and pick an XML file that follows the project's arch XML format.
- Click `Save` to download the current architecture as `architecture.xml`.
- Click `Sample` to load the included example architecture.
- Toggle UI: press `U`. Toggle cursor: press `Q`.

## 📜 Example XML

Below is the sample XML used by the app (also present in `src/main.js`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<arch>
  <node id="root" name="ROOT" pos="0,0,0" category="legend-core" scale="1">
    <node id="api-gateway" name="API Gateway" pos="10,5,0" category="legend-modules" scale="0.8">
      <node id="auth-service" name="Auth Service" pos="15,8,5" category="legend-components" scale="0.6" />
      <node id="rate-limiter" name="Rate Limiter" pos="15,8,-5" category="legend-components" scale="0.6" />
    </node>
    <node id="database-layer" name="Database Layer" pos="-10,5,0" category="legend-data" scale="0.8">
      <node id="primary-db" name="Primary DB" pos="-15,8,5" category="legend-components" scale="0.6" />
      <node id="cache" name="Cache" pos="-15,8,-5" category="legend-components" scale="0.6" />
    </node>
    <node id="workers" name="Workers" pos="0,-5,10" category="legend-modules" scale="0.8">
      <node id="job-queue" name="Job Queue" pos="5,-8,15" category="legend-components" scale="0.6" />
      <node id="worker-pool" name="Worker Pool" pos="-5,-8,15" category="legend-components" scale="0.6" />
    </node>
  </node>
  <legend>
    <entry id="legend-core" name="Core Services" color="#00ffff" />
    <entry id="legend-modules" name="Modules" color="#ff00ff" />
    <entry id="legend-components" name="Components" color="#ffff00" />
    <entry id="legend-data" name="Data Layer" color="#00ff00" />
  </legend>
  <ui-info>
    <title>MICROSERVICES ARCHITECTURE</title>
  </ui-info>
</arch>
```

## 📚 XML format notes

- The root element is `<arch>`.
- The main scene root is the first `<node>` child of `<arch>`. Each `<node>` must include:
  - `name` - string
  - `pos` - three comma-separated numbers (x,y,z)
  - `color` - hex color string, e.g. `#ff00ff`
  - optional `scale` - number
- Nodes may nest arbitrarily via child `<node>` entries.
- Optional `<legend>` and `<ui-info>` sections are supported.

## 🐞 Troubleshooting

- If loading fails, open the browser console to see parsing errors. The app shows brief messages in the UI as well.
- ✅ Ensure your XML is UTF-8 encoded and well-formed.
