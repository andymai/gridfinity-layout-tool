import { useEffect, useMemo, type ComponentProps } from 'react';
import { useShallow } from 'zustand/react/shallow';
import * as THREE from 'three';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { resolveConnectorStyle } from '@/shared/types/bin';
import {
  MAGNET_FLOOR_MM,
  SNAP_CLIP_LENGTH,
  SNAP_CLIP_WIDTH,
  SNAP_CLIP_DEPTH,
  SNAP_CLIP_SNAP,
  SNAP_CLIP_THICKNESS,
  SNAP_CLIP_COMPRESSION,
} from '@/shared/printSettings/snapClipGeometry';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { computeSnapClipPositions } from './snapClipPositions';

const OPACITY_CLOSED = 0.7;
const OPACITY_OPEN = 0.95;
const OPACITY_INTERP_START_MM = 5;
const OPACITY_INTERP_END_MM = 25;

function opacityForOffset(offsetMm: number): number {
  if (offsetMm <= OPACITY_INTERP_START_MM) return OPACITY_CLOSED;
  if (offsetMm >= OPACITY_INTERP_END_MM) return OPACITY_OPEN;
  const t =
    (offsetMm - OPACITY_INTERP_START_MM) / (OPACITY_INTERP_END_MM - OPACITY_INTERP_START_MM);
  return OPACITY_CLOSED + t * (OPACITY_OPEN - OPACITY_CLOSED);
}

// Match snapClipBuilder.ts.rabbitPinOutline so the preview tracks the worker.
function rabbitHalfPath(): Array<[number, number]> {
  const t = SNAP_CLIP_THICKNESS;
  const snap = SNAP_CLIP_SNAP;
  const length = SNAP_CLIP_LENGTH;
  const width = SNAP_CLIP_WIDTH;
  const compression = SNAP_CLIP_COMPRESSION;

  const earwidth = 2 * t + snap;
  const pointLength = earwidth / 2.15;
  const scaledLen =
    length -
    (0.5 * (earwidth * snap + pointLength * length)) / Math.sqrt(snap * snap + (length / 2) ** 2);
  const bottomPtY = Math.max(scaledLen * 0.15 + t, 2 * t);

  const halfW = width / 2;
  const earX = halfW + compression;
  const waistX = halfW - snap;
  const tipOutX = halfW * 0.4;
  const tipOutY = scaledLen + t * 0.5;
  const tipInX = t;
  const tipInY = scaledLen - t * 0.5;

  return [
    [halfW, 0],
    [waistX, scaledLen / 2],
    [earX, scaledLen],
    [tipOutX, tipOutY],
    [tipInX, tipInY],
    [0, bottomPtY],
    [-tipInX, tipInY],
    [-tipOutX, tipOutY],
    [-earX, scaledLen],
    [-waistX, scaledLen / 2],
    [-halfW, 0],
  ];
}

function buildDoubleClipShape(): THREE.Shape {
  const half = rabbitHalfPath();
  // Mirror across Y=0 (negate y) and reverse so the combined ring is closed CCW.
  const mirror: Array<[number, number]> = [...half]
    .reverse()
    .map(([x, y]) => [x, -y] as [number, number]);
  // Full closed outline: upper half (y >= 0) then lower half (y <= 0).
  // Y=0 endpoints overlap, which THREE accepts as a closed contour.
  const full = [...half, ...mirror];
  const shape = new THREE.Shape();
  shape.moveTo(full[0][0], full[0][1]);
  for (let i = 1; i < full.length; i++) shape.lineTo(full[i][0], full[i][1]);
  shape.closePath();
  return shape;
}

type MaterialProps = ComponentProps<'meshStandardMaterial'>;

function SnapClipPart({ material }: { material: MaterialProps }) {
  const geometry = useMemo(() => {
    const shape = buildDoubleClipShape();
    return new THREE.ExtrudeGeometry(shape, {
      depth: SNAP_CLIP_DEPTH,
      bevelEnabled: false,
      curveSegments: 8,
    });
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial {...material} />
    </mesh>
  );
}

interface SnapClipPreviewProps {
  /** Lift offset (mm) above the seated position. */
  readonly offsetMm?: number;
}

export function SnapClipPreview({ offsetMm = 0 }: SnapClipPreviewProps) {
  const { baseplateParams, gridUnitMm } = useLayoutStore(
    useShallow((s) => ({
      baseplateParams: s.layout.baseplateParams,
      gridUnitMm: s.layout.gridUnitMm,
    }))
  );

  const { tiling, splitViewMode } = useBaseplatePageStore(
    useShallow((s) => ({ tiling: s.tiling, splitViewMode: s.splitViewMode }))
  );

  const filamentColor = useSettingsStore((s) => s.settings.baseplateFilamentColor);

  const enabled =
    !!baseplateParams &&
    resolveConnectorStyle(baseplateParams) === 'snap' &&
    !!tiling &&
    tiling.isSplit &&
    splitViewMode !== 'exploded';

  const positions = useMemo(() => {
    if (!enabled) return [];
    // `enabled` already requires non-null tiling, but TS narrowing doesn't
    // propagate through the boolean variable.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see above
    if (!tiling) return [];
    return computeSnapClipPositions(tiling, gridUnitMm);
  }, [enabled, tiling, gridUnitMm]);

  const slabThickness = baseplateParams
    ? GRIDFINITY_SPEC.SOCKET_HEIGHT +
      (baseplateParams.magnetHoles ? MAGNET_FLOOR_MM + baseplateParams.magnetDepth : 0)
    : GRIDFINITY_SPEC.SOCKET_HEIGHT;

  const material = useMemo<MaterialProps>(
    () => ({
      color: filamentColor,
      transparent: true,
      opacity: opacityForOffset(offsetMm),
      roughness: 0.45,
      metalness: 0,
    }),
    [filamentColor, offsetMm]
  );

  if (!enabled || positions.length === 0) return null;

  // Clip sits centred in the slab vertically — pocket is at slab mid. Lift by
  // offsetMm to slide it out for inspection.
  const groupBaseZ = slabThickness / 2 - SNAP_CLIP_DEPTH / 2 + offsetMm;

  return (
    <group>
      {positions.map((pos, i) => {
        // Canonical clip has length along Y. Vertical seams need length along
        // X (perpendicular to seam direction), so rotate 90°.
        const rotZ = pos.orientation === 'verticalSeam' ? Math.PI / 2 : 0;
        return (
          <group key={i} position={[pos.x, pos.y, groupBaseZ]} rotation={[0, 0, rotZ]}>
            <SnapClipPart material={material} />
          </group>
        );
      })}
    </group>
  );
}
