/**
 * Calculate zoom level to fit a box in the viewport.
 * For orthographic camera, zoom determines how many world units fit in the view.
 */
export function calculateFitZoom(
  drawerWidth: number,
  drawerDepth: number,
  drawerHeight: number,
  heightToGridScale: number,
  viewportWidth: number,
  viewportHeight: number
): number {
  const heightInGridUnits = drawerHeight * heightToGridScale;

  // For isometric view, estimate the projected bounding box
  // The diagonal footprint is roughly width + depth (at 45° view)
  // Height adds to the vertical extent
  const projectedWidth = (drawerWidth + drawerDepth) * 0.7; // Isometric projection factor
  const projectedHeight = (drawerWidth + drawerDepth) * 0.35 + heightInGridUnits; // Depth contributes to height

  // Calculate zoom to fit with 15% margin on each side
  const marginFactor = 0.7; // 70% of viewport used for content
  const zoomForWidth = (viewportWidth * marginFactor) / projectedWidth;
  const zoomForHeight = (viewportHeight * marginFactor) / projectedHeight;

  // Use the smaller zoom to ensure everything fits
  return Math.min(zoomForWidth, zoomForHeight);
}

/** A framed bin fills about this share of the fit-to-bin view, so its neighbours stay in sight. */
const BIN_FRAME_SHARE = 0.45;
/** Framing zooms in at most this many times past the whole-drawer fit. */
const MAX_FRAME_ZOOM = 4;

export interface BinFrameInput {
  readonly bin: { x: number; y: number; width: number; depth: number; height: number };
  /** The bin's resting height in height units, from the resting stack. */
  readonly zStart: number;
  readonly drawer: { width: number; depth: number; height: number };
  readonly depthToGridScale: number;
  readonly heightToGridScale: number;
  readonly viewport: { width: number; height: number };
  /** Null for a perspective camera, which has no zoom to set. */
  readonly currentZoom: number | null;
  readonly currentTargetZ: number;
  /** The exploded view lifts each layer, so there the frame keeps its height. */
  readonly exploded: boolean;
}

export interface BinFrame {
  readonly target: readonly [number, number, number];
  /** Null leaves the zoom as it is. */
  readonly zoom: number | null;
}

/**
 * Where the camera looks and how far it zooms to frame a found bin: its centre,
 * and close enough to pick it out, never further out than the view already is.
 */
export function planBinFrame(input: BinFrameInput): BinFrame {
  const { bin, drawer, depthToGridScale, heightToGridScale, viewport } = input;
  const target = [
    bin.x + bin.width / 2,
    (bin.y + bin.depth / 2) * depthToGridScale,
    input.exploded ? input.currentTargetZ : (input.zStart + bin.height / 2) * heightToGridScale,
  ] as const;
  if (input.currentZoom === null || input.exploded) return { target, zoom: null };
  const binFit = calculateFitZoom(
    bin.width,
    bin.depth * depthToGridScale,
    bin.height,
    heightToGridScale,
    viewport.width,
    viewport.height
  );
  const drawerFit = calculateFitZoom(
    drawer.width,
    drawer.depth * depthToGridScale,
    drawer.height,
    heightToGridScale,
    viewport.width,
    viewport.height
  );
  const zoom = Math.max(
    input.currentZoom,
    Math.min(binFit * BIN_FRAME_SHARE, drawerFit * MAX_FRAME_ZOOM)
  );
  return { target, zoom };
}
