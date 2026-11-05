import { mount } from "svelte";
import App from "./App.svelte";
import "./app.css";
import { createWheelZoom } from "./lib/wheel-zoom";

// Ctrl/Cmd + wheel (also a trackpad pinch) zooms the whole app, in the steps of Ansicht > Vergrößern.
// Capture phase: Monaco and the panels consume wheel events before they would bubble up to window.
// The diagram viewer marks itself data-own-zoom and zooms the diagram instead.
const wheelZoom = createWheelZoom();
window.addEventListener(
  "wheel",
  (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    if (e.target instanceof Element && e.target.closest("[data-own-zoom]")) return;
    e.preventDefault();
    const steps = wheelZoom(e, e.timeStamp);
    if (steps !== 0) window.jide.zoomStep(steps);
  },
  { capture: true, passive: false }
);

mount(App, { target: document.getElementById("app")! });
