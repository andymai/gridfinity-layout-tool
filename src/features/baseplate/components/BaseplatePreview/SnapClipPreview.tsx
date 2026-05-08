/**
 * Translucent preview of snap-clip parts in their assembled positions.
 *
 * Mirrors the bin designer's `<LidMesh>` pattern: shows where the parts go
 * without claiming to be the printed STL. Geometry is built from R3F
 * primitives (cheap; no BREP roundtrip needed) — bridge box, two prong
 * cylinders, two cone barbs each. One instance per snap location.
 *
 * Visibility:
 * - Only when `connectorStyle === 'snap'` and the baseplate is split.
 * - Closed (default): clip in assembled position, bridge in the recess.
 * - Exploded view: clip lifted above the slab so prongs are visible.
 */

import { useMemo, type ComponentProps } from 'react';
import { useShallow } from 'zustand/react/shallow';
import * as THREE from 'three';
import { useLayoutStore } from '@/core/store/layout';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { resolveConnectorStyle } from '@/shared/types/bin';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { computeSnapClipPositions } from './snapClipPositions';

// Mirror constants from generatorConstants.ts. Kept in sync via the unit test
// that imports the canonical values; if you change the geometry there, this
// preview's silhouette will drift until matching.
const PRONG_DIAMETER = 3.0;
const PRONG_INSET = 5.0;
const PRONG_OVERSHOOT = 0.5;
const BRIDGE_THICKNESS = 1.5;
const BRIDGE_WIDTH = 6.0;
const BRIDGE_LENGTH_MARGIN = 2.0;
const BARB_FLARE = 0.25;
const BARB_RETAIN_HEIGHT = 0.5;
const BARB_LEAD_HEIGHT = 1.0;
const TIP_RADIUS = 1.0;

const PRONG_RADIUS = PRONG_DIAMETER / 2;
const BARB_RADIUS = PRONG_RADIUS + BARB_FLARE;
const BRIDGE_LEN = 2 * (PRONG_INSET + BRIDGE_LENGTH_MARGIN);
const PRONG_CENTER_OFFSET = PRONG_INSET;

const CYLINDER_SEGMENTS = 16;

/** Opacity bands mirror the lid's pattern: closer to closed reads more
 *  translucent (less likely to be read as "the part to print"); fully
 *  separated reads near-solid for inspection. */
const OPACITY_CLOSED = 0.55;
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

type MaterialProps = ComponentProps<'meshStandardMaterial'>;

interface SnapClipInstanceProps {
  readonly slabThickness: number;
  readonly material: MaterialProps;
}

/**
 * One snap clip in local frame: bridge at origin (z = 0 to bridgeThick),
 * prongs descending in -Z by slabThickness + overshoot, barbs below.
 */
function SnapClipPart({ slabThickness, material }: SnapClipInstanceProps) {
  const shaftLen = slabThickness + PRONG_OVERSHOOT;

  // Pre-build cylinder/cone geometries (memoize so prong count of N doesn't
  // create N copies of identical buffers).
  const geoms = useMemo(() => {
    return {
      bridge: new THREE.BoxGeometry(BRIDGE_LEN, BRIDGE_WIDTH, BRIDGE_THICKNESS),
      shaft: new THREE.CylinderGeometry(PRONG_RADIUS, PRONG_RADIUS, shaftLen, CYLINDER_SEGMENTS),
      shoulder: new THREE.CylinderGeometry(
        PRONG_RADIUS,
        BARB_RADIUS,
        BARB_RETAIN_HEIGHT,
        CYLINDER_SEGMENTS
      ),
      lead: new THREE.CylinderGeometry(
        BARB_RADIUS,
        TIP_RADIUS,
        BARB_LEAD_HEIGHT,
        CYLINDER_SEGMENTS
      ),
    };
  }, [shaftLen]);

  const renderProng = (centerX: number) => {
    // In use orientation, prongs descend from below the bridge into -Z.
    // Three.js cylinders are oriented along Y by default — rotate -90° about
    // X so they point down (-Z direction).
    const shaftCenterZ = -shaftLen / 2;
    const shoulderCenterZ = -(shaftLen + BARB_RETAIN_HEIGHT / 2);
    const leadCenterZ = -(shaftLen + BARB_RETAIN_HEIGHT + BARB_LEAD_HEIGHT / 2);
    const rotX: [number, number, number] = [-Math.PI / 2, 0, 0];
    return (
      <group key={centerX}>
        <mesh geometry={geoms.shaft} position={[centerX, 0, shaftCenterZ]} rotation={rotX}>
          <meshStandardMaterial {...material} />
        </mesh>
        <mesh geometry={geoms.shoulder} position={[centerX, 0, shoulderCenterZ]} rotation={rotX}>
          <meshStandardMaterial {...material} />
        </mesh>
        <mesh geometry={geoms.lead} position={[centerX, 0, leadCenterZ]} rotation={rotX}>
          <meshStandardMaterial {...material} />
        </mesh>
      </group>
    );
  };

  return (
    <group>
      <mesh geometry={geoms.bridge} position={[0, 0, BRIDGE_THICKNESS / 2]}>
        <meshStandardMaterial {...material} />
      </mesh>
      {renderProng(-PRONG_CENTER_OFFSET)}
      {renderProng(PRONG_CENTER_OFFSET)}
    </group>
  );
}

interface SnapClipPreviewProps {
  /** Color tint for the clip (typically a contrasting accent vs the slab). */
  readonly color?: string;
  /** Continuous offset (mm) by which the clip is lifted above its mated
   *  position. 0 = closed (bridge in recess). */
  readonly offsetMm?: number;
}

/** Default clip tint — contrasting blue so clips read distinctly from the
 *  slab without competing with the user's filament color. */
const DEFAULT_CLIP_COLOR = '#3b82f6';

export function SnapClipPreview({
  color = DEFAULT_CLIP_COLOR,
  offsetMm = 0,
}: SnapClipPreviewProps) {
  const { baseplateParams, gridUnitMm } = useLayoutStore(
    useShallow((s) => ({
      baseplateParams: s.layout.baseplateParams,
      gridUnitMm: s.layout.gridUnitMm,
    }))
  );

  const tiling = useBaseplatePageStore((s) => s.tiling);

  const enabled =
    !!baseplateParams &&
    resolveConnectorStyle(baseplateParams) === 'snap' &&
    !!tiling &&
    tiling.isSplit;

  const positions = useMemo(
    () => (enabled ? computeSnapClipPositions(tiling, gridUnitMm) : []),
    [enabled, tiling, gridUnitMm]
  );

  const slabThickness = useMemo(() => {
    if (!baseplateParams) return GRIDFINITY_SPEC.SOCKET_HEIGHT;
    return (
      GRIDFINITY_SPEC.SOCKET_HEIGHT +
      (baseplateParams.magnetHoles ? 0.5 + baseplateParams.magnetDepth : 0)
    );
  }, [baseplateParams]);

  const material = useMemo<MaterialProps>(
    () => ({
      color,
      transparent: true,
      opacity: opacityForOffset(offsetMm),
      roughness: 0.45,
      metalness: 0,
    }),
    [color, offsetMm]
  );

  if (!enabled || positions.length === 0) return null;

  // Slab top in scene Z (post-shift): slabThickness; recess floor at top - 1.7.
  // Bridge sits in the recess so its bottom is at top - 1.7. In the clip's
  // local frame the bridge bottom is at z=0, so we translate the group by
  // (slabThickness - SNAP_BRIDGE_RECESS_DEPTH) + offsetMm.
  const RECESS_DEPTH = BRIDGE_THICKNESS + 0.2;
  const groupBaseZ = slabThickness - RECESS_DEPTH + offsetMm;

  return (
    <group>
      {positions.map((pos, i) => {
        const rotZ = pos.orientation === 'horizontalSeam' ? Math.PI / 2 : 0;
        return (
          <group key={i} position={[pos.x, pos.y, groupBaseZ]} rotation={[0, 0, rotZ]}>
            <SnapClipPart slabThickness={slabThickness} material={material} />
          </group>
        );
      })}
    </group>
  );
}
