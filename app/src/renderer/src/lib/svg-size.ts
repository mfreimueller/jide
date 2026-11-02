export interface Size {
  width: number;
  height: number;
}

/** Zoom steps of the "+" / "−" buttons, as fractions of 100 %. */
export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2, 3, 4];
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8;

/** Data URL for an <img>: no script of the SVG ever runs this way. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function rootTag(svg: string): string {
  return /<svg\b[^>]*>/i.exec(svg)?.[0] ?? "";
}

function attrNumber(tag: string, name: string): number | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*["']\\s*([0-9.]+)\\s*(px)?\\s*["']`, "i").exec(tag);
  const n = m ? Number(m[1]) : NaN;
  return n > 0 ? n : undefined;
}

/** Size from the width/height attributes of the root <svg> (PlantUML sets them), else from its viewBox. */
export function svgSize(svg: string): Size | undefined {
  const tag = rootTag(svg);
  const width = attrNumber(tag, "width");
  const height = attrNumber(tag, "height");
  if (width && height) return { width, height };
  const vb = /\sviewBox\s*=\s*["']\s*[-0-9.]+[\s,]+[-0-9.]+[\s,]+([0-9.]+)[\s,]+([0-9.]+)\s*["']/i.exec(tag);
  if (vb && Number(vb[1]) > 0 && Number(vb[2]) > 0) return { width: Number(vb[1]), height: Number(vb[2]) };
  return undefined;
}

/** Next zoom step above `scale`, or the largest step. */
export function zoomIn(scale: number): number {
  return ZOOM_STEPS.find((s) => s > scale + 0.005) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]!;
}

/** Next zoom step below `scale`, or the smallest step. */
export function zoomOut(scale: number): number {
  return [...ZOOM_STEPS].reverse().find((s) => s < scale - 0.005) ?? ZOOM_STEPS[0]!;
}

/** Scale that shows the whole image in the box, never above 100 %. */
export function fitScale(image: Size, box: Size): number {
  if (image.width <= 0 || image.height <= 0 || box.width <= 0 || box.height <= 0) return 1;
  return Math.min(1, box.width / image.width, box.height / image.height);
}
