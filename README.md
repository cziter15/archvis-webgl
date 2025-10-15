# 🖥️ ArchVis WebGL

[![Deploy to GitHub Pages](https://github.com/cziter15/archvis%2Dwebgl/actions/workflows/pages.yml/badge.svg)](https://github.com/cziter15/archvis%2Dwebgl/actions/workflows/pages.yml) [![Lines of Code](https://img.shields.io/endpoint?color=blue&url=https%3A%2F%2Fghloc.vercel.app%2Fapi%2Fcziter15%2Farchvis%252Dwebgl%2Fbadge%3Ffilter%3D.hpp%24%2C.cpp%24%2C.h%24%26label%3DLines%2520of%2520Code)](https://github.com/cziter15/archvis%2Dwebgl)

> **ArchVis WebGL** is a small interactive WebGL-based architecture visualization built with Three.js and Vite.<br>
> Initialy vibe-coded with Claude 4.5 and GLM 4.5, then moved manually into Vite-based solution.
>
> It loads and saves architectures as XML and provides a 3D view with orbit/pan/zoom controls and animated nodes.<br>
> A sample architecture is included for quick demos.

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

- Click the "Load" button and pick an XML file that follows the project's arch XML format.
- Click "Save" to download the current architecture as `architecture.xml`.
- Click "Sample" to load the included example architecture.
- Toggle UI: press `U`. Toggle cursor: press `Q`.

## 📜 Example XML

Below is the sample XML used by the app (also present in `src/main.js`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<arch>
  <node name="ROOT" pos="0,0,0" color="#00ffff" scale="1">
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
    <entry name="Core Services" color="#00ffff" />
    <entry name="Modules" color="#ff00ff" />
    <entry name="Components" color="#ffff00" />
    <entry name="Data Layer" color="#00ff00" />
  </legend>
  <ui-info>
    <title>MICROSERVICES ARCHITECTURE</title>
  </ui-info>
</arch>
```

## 📚 XML format notes

- The root element is `<arch>`.
- The main scene root is the first `<node>` child of `<arch>`. Each `<node>` must include:
  - `name` — string
  - `pos` — three comma-separated numbers (x,y,z)
  - `color` — hex color string, e.g. `#ff00ff`
  - optional `scale` — number
- Nodes may nest arbitrarily via child `<node>` entries.
- Optional `<legend>` and `<ui-info>` sections are supported.

## 🐞 Troubleshooting

- If loading fails, open the browser console to see parsing errors. The app shows brief messages in the UI as well.
- ✅ Ensure your XML is UTF-8 encoded and well-formed.