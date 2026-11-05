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
    // Chromium divides pixel deltas by the page zoom (a 100 px notch is 83 px at 120 %): undo that,
    // otherwise a notch would fall short of a step once the app is zoomed in.
    const deltaY = e.deltaMode === 0 ? e.deltaY * window.jide.zoomFactor() : e.deltaY;
    const steps = wheelZoom({ deltaY, deltaMode: e.deltaMode }, e.timeStamp);
    if (steps !== 0) window.jide.zoomStep(steps);
  },
  { capture: true, passive: false }
);

mount(App, { target: document.getElementById("app")! });
