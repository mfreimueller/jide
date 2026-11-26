import { mount } from "svelte";
import App from "./App.svelte";
import PanelWindow from "./lib/PanelWindow.svelte";
import "./app.css";

// The app has no window zoom (only the editor font changes, via Ansicht): Ctrl/Cmd + wheel and a trackpad pinch
// must not trigger Chromium's page zoom. Capture phase: Monaco and the panels consume wheel events before
// they would bubble up to window. The diagram viewer marks itself data-own-zoom and zooms the diagram instead.
window.addEventListener(
  "wheel",
  (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    if (e.target instanceof Element && e.target.closest("[data-own-zoom]")) return;
    e.preventDefault();
  },
  { capture: true, passive: false }
);

// The window of a detached panel (?panel=...) shows only that panel; every other window is the app.
mount(window.jide.panels.window ? PanelWindow : App, { target: document.getElementById("app")! });
