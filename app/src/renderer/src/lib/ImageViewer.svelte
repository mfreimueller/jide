<script lang="ts">
  import { onMount } from "svelte";
  import {
    fitScale,
    svgDataUrl,
    svgSize,
    zoomIn,
    zoomOut,
    ZOOM_MAX,
    ZOOM_MIN,
    type Size
  } from "./svg-size";

  let { path, svg }: { path: string; svg: string } = $props();

  const PAD = 24;
  // Workspace re-creates the viewer for every image (keyed each), so reading the props once is fine.
  // svelte-ignore state_referenced_locally
  let size = $state<Size | undefined>(svgSize(svg));
  // svelte-ignore state_referenced_locally
  const url = svgDataUrl(svg);
  let areaW = $state(0);
  let areaH = $state(0);
  let fit = $state(true);
  let zoom = $state(1);
  let scroller: HTMLDivElement;

  const shown = $derived(
    fit && size ? fitScale(size, { width: areaW - PAD * 2, height: areaH - PAD * 2 }) : zoom
  );
  const percent = $derived(Math.round(shown * 100));

  function onLoad(e: Event): void {
    if (size) return;
    const img = e.currentTarget as HTMLImageElement;
    size = { width: img.naturalWidth || 300, height: img.naturalHeight || 150 };
  }

  function setZoom(next: number): void {
    zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    fit = false;
  }
  const zoomBy = (step: (s: number) => number) => () => setZoom(step(shown));

  onMount(() => {
    // Ctrl + wheel (also what a trackpad pinch sends) zooms around the pointer; plain wheel scrolls.
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = scroller.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const before = shown;
      const ax = (scroller.scrollLeft + px) / before;
      const ay = (scroller.scrollTop + py) / before;
      setZoom(before * Math.exp(-e.deltaY / 200));
      requestAnimationFrame(() => {
        scroller.scrollLeft = ax * zoom - px;
        scroller.scrollTop = ay * zoom - py;
      });
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  });

  // Drag to pan.
  let panning = $state(false);
  let drag: { x: number; y: number; left: number; top: number } | undefined;
  function down(e: PointerEvent): void {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, left: scroller.scrollLeft, top: scroller.scrollTop };
    panning = true;
    scroller.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent): void {
    if (!drag) return;
    scroller.scrollLeft = drag.left - (e.clientX - drag.x);
    scroller.scrollTop = drag.top - (e.clientY - drag.y);
  }
  function up(): void {
    drag = undefined;
    panning = false;
  }
</script>

<div class="viewer" data-testid="image-viewer">
  <div class="bar">
    <span class="name">{path} · nur lesen</span>
    <span class="spacer"></span>
    <button class="btn" onclick={zoomBy(zoomOut)} title="Verkleinern" data-testid="zoom-out">−</button>
    <span class="level" data-testid="zoom-level">{percent} %</span>
    <button class="btn" onclick={zoomBy(zoomIn)} title="Vergrößern" data-testid="zoom-in">+</button>
    <button class="btn" onclick={() => setZoom(1)} data-testid="zoom-100">100 %</button>
    <button class="btn" class:active={fit} onclick={() => (fit = true)} data-testid="zoom-fit">Einpassen</button>
  </div>
  <div class="area" bind:clientWidth={areaW} bind:clientHeight={areaH}>
    <div
      class="scroller"
      class:panning
      role="presentation"
      bind:this={scroller}
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
    >
      <div class="sheet" style:padding="{PAD}px">
        <img
          src={url}
          alt={path}
          draggable="false"
          onload={onLoad}
          style:width={size ? `${size.width * shown}px` : undefined}
          style:height={size ? `${size.height * shown}px` : undefined}
          data-testid="image-viewer-img"
        />
      </div>
    </div>
    <div class="hint">Strg + Mausrad zoomt · Ziehen/Scrollen verschiebt</div>
  </div>
</div>

<style>
  .viewer {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .bar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-panel);
    border-bottom: 1px solid var(--border);
    padding: 6px 10px 6px 14px;
  }
  .name {
    font-size: 12px;
    color: var(--text-faint);
  }
  .spacer {
    flex: 1;
  }
  .level {
    font-size: 12px;
    color: var(--text-2);
    min-width: 42px;
    text-align: center;
  }
  .btn {
    font: inherit;
    font-size: 12px;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    background: var(--bg-subtle);
    color: var(--text-2);
    padding: 4px 10px;
    cursor: pointer;
  }
  .btn.active {
    background: var(--bg-selected);
    color: var(--text-link);
  }
  .area {
    position: relative;
    flex: 1;
    min-height: 0;
    background: var(--bg-app);
  }
  .scroller {
    position: absolute;
    inset: 0;
    overflow: auto;
    display: flex;
    cursor: grab;
  }
  .scroller.panning {
    cursor: grabbing;
  }
  /* margin: auto centers the sheet while it is smaller and lets it scroll from the top-left when larger. */
  .sheet {
    margin: auto;
    box-sizing: content-box;
    flex: none;
  }
  .sheet img {
    display: block;
    background: #fff; /* drawn for white paper, also in dark mode */
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
    user-select: none;
  }
  .hint {
    position: absolute;
    right: 12px;
    bottom: 12px;
    background: var(--bg-dark);
    color: #fff;
    font-size: 11px;
    border-radius: 6px;
    padding: 5px 8px;
    pointer-events: none;
  }
</style>
