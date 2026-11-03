/** The inset's side, in CSS pixels. */
export const LOUPE_PX = 168;
/** Gap between the inset and the canvas edge, in CSS pixels. */
export const LOUPE_MARGIN_PX = 12;
/** How much closer the inset looks than the canvas around it. */
export const LOUPE_ZOOM = 3;

export interface LoupeRect {
  /** Left edge, from the canvas's left, in CSS pixels. */
  readonly x: number;
  /** Bottom edge, from the canvas's bottom: WebGL counts viewports up from there. */
  readonly y: number;
  readonly size: number;
}

/** Smallest inset worth showing, in CSS pixels. */
const MIN_LOUPE_PX = 96;

/** The inset's side on a canvas this size: its full size where there is room, less on a narrow one. */
function loupeSize(canvas: { readonly width: number; readonly height: number }): number | null {
  const size = Math.min(
    LOUPE_PX,
    Math.floor((canvas.width - LOUPE_MARGIN_PX * 3) / 2),
    canvas.height - LOUPE_MARGIN_PX * 2
  );
  return size >= MIN_LOUPE_PX ? size : null;
}

/**
 * Where the inset sits: along the top, in the half the point is not in, so
 * the inset never covers what it shows. A canvas too small for it gets none.
 */
export function loupeRect(
  pointPx: { readonly x: number; readonly y: number },
  canvas: { readonly width: number; readonly height: number }
): LoupeRect | null {
  const size = loupeSize(canvas);
  if (size === null) return null;
  const left = pointPx.x > canvas.width / 2;
  return {
    x: left ? LOUPE_MARGIN_PX : canvas.width - LOUPE_MARGIN_PX - size,
    y: canvas.height - LOUPE_MARGIN_PX - size,
    size,
  };
}

/**
 * The inset camera's frustum about the point, in world units at the main
 * camera's zoom: an orthographic camera divides its frustum by its zoom, so
 * the inset's half-width in pixels is enough.
 */
export function loupeFrustum(size: number): {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
} {
  const half = size / 2;
  return { left: -half, right: half, top: half, bottom: -half };
}

/** The same placement for a loupe laid out from the top-left, as the DOM is. */
export function loupeTopLeft(
  pointX: number,
  canvas: { readonly width: number; readonly height: number }
): { left: number; top: number; size: number } | null {
  const size = loupeSize(canvas);
  if (size === null) return null;
  const left = pointX > canvas.width / 2;
  return {
    left: left ? LOUPE_MARGIN_PX : canvas.width - LOUPE_MARGIN_PX - size,
    top: LOUPE_MARGIN_PX,
    size,
  };
}
