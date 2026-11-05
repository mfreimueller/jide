<script lang="ts">
  /**
   * Drag handle on a panel edge. A zero-size flex item whose hit area overlaps the border; on hover (and
   * while dragging) the border turns into a 3px primary-blue line. `apply` gets the distance moved since
   * the pointer went down, in px along the axis (positive = right/down).
   */
  let {
    dir,
    begin,
    apply,
    testid
  }: {
    dir: "col" | "row";
    /** Called on pointer down, so the caller can remember the size it starts from. */
    begin: () => void;
    apply: (delta: number) => void;
    testid: string;
  } = $props();

  let dragging = $state(false);
  let origin = 0;

  const pos = (e: PointerEvent): number => (dir === "col" ? e.clientX : e.clientY);

  function down(e: PointerEvent): void {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    origin = pos(e);
    begin();
    dragging = true;
    document.body.style.cursor = dir === "col" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  }
  function move(e: PointerEvent): void {
    if (dragging) apply(pos(e) - origin);
  }
  function up(): void {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }
</script>

<div
  class="handle {dir}"
  class:dragging
  role="separator"
  aria-orientation={dir === "col" ? "vertical" : "horizontal"}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  data-testid={testid}
></div>

<style>
  .handle {
    position: relative;
    flex: none;
    z-index: 20;
  }
  .handle.col {
    width: 0;
    cursor: col-resize;
  }
  .handle.row {
    height: 0;
    cursor: row-resize;
  }
  /* hit area of 8px over the border */
  .handle.col::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: -4px;
    width: 8px;
  }
  .handle.row::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: -4px;
    height: 8px;
  }
  .handle::after {
    content: "";
    position: absolute;
    background: var(--primary);
    opacity: 0;
  }
  .handle.col::after {
    top: 0;
    bottom: 0;
    left: -1px;
    width: 3px;
  }
  .handle.row::after {
    left: 0;
    right: 0;
    top: -1px;
    height: 3px;
  }
  .handle:hover::after,
  .handle.dragging::after {
    opacity: 1;
  }
</style>
