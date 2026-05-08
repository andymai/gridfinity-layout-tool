import { useEffect, useMemo, type ComponentProps } from 'react';
import { useShallow } from 'zustand/react/shallow';
import * as THREE from 'three';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { resolveConnectorStyle } from '@/shared/types/bin';
import {
  MAGNET_FLOOR_MM,
  SNAP_PEG_DIAMETER,
  SNAP_PEG_INSET,
  SNAP_PEG_LENGTH,
  SNAP_SADDLE_WIDTH,
  SNAP_SADDLE_LENGTH_MARGIN,
  SNAP_SADDLE_BASE_HEIGHT,
  SNAP_SADDLE_ARCH_RISE,
  SNAP_RECESS_DEPTH,
} from '@/shared/printSettings/snapClipGeometry';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { computeSnapClipPositions } from './snapClipPositions';

const PEG_RADIUS = SNAP_PEG_DIAMETER / 2;
const SADDLE_LEN = 2 * (SNAP_PEG_INSET + SNAP_SADDLE_LENGTH_MARGIN);
const CYLINDER_SEGMENTS = 16;

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

type MaterialProps = ComponentProps<'meshStandardMaterial'>;

function SnapClipPart({ material }: { material: MaterialProps }) {
  const geoms = useMemo(
    () => ({
      base: new THREE.BoxGeometry(SADDLE_LEN, SNAP_SADDLE_WIDTH, SNAP_SADDLE_BASE_HEIGHT),
      arch: new THREE.CylinderGeometry(
        SNAP_SADDLE_ARCH_RISE,
        SNAP_SADDLE_ARCH_RISE,
        SADDLE_LEN,
        CYLINDER_SEGMENTS
      ),
      peg: new THREE.CylinderGeometry(PEG_RADIUS, PEG_RADIUS, SNAP_PEG_LENGTH, CYLINDER_SEGMENTS),
    }),
    []
  );

  // Three.js doesn't dispose buffer geometries on React unmount.
  useEffect(() => {
    return () => {
      geoms.base.dispose();
      geoms.arch.dispose();
      geoms.peg.dispose();
    };
  }, [geoms]);

  // Cylinders default to Y-axis. Arch lays along X (rotate 90° about Z); pegs
  // hang along -Z (rotate -90° about X).
  const archRot: [number, number, number] = [0, 0, Math.PI / 2];
  const pegRot: [number, number, number] = [-Math.PI / 2, 0, 0];

  const archZ = SNAP_SADDLE_BASE_HEIGHT;
  const pegZ = -SNAP_PEG_LENGTH / 2;

  return (
    <group>
      <mesh geometry={geoms.base} position={[0, 0, SNAP_SADDLE_BASE_HEIGHT / 2]}>
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh geometry={geoms.arch} position={[0, 0, archZ]} rotation={archRot}>
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh geometry={geoms.peg} position={[-SNAP_PEG_INSET, 0, pegZ]} rotation={pegRot}>
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh geometry={geoms.peg} position={[SNAP_PEG_INSET, 0, pegZ]} rotation={pegRot}>
        <meshStandardMaterial {...material} />
      </mesh>
    </group>
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

  // Saddle base sits inside the recess so its shoulder is flush with the slab
  // top. The local frame's z=0 is the saddle's underside; place the group so
  // z=0 lands at (slabTop - RECESS_DEPTH).
  const groupBaseZ = slabThickness - SNAP_RECESS_DEPTH + offsetMm;

  return (
    <group>
      {positions.map((pos, i) => {
        const rotZ = pos.orientation === 'horizontalSeam' ? Math.PI / 2 : 0;
        return (
          <group key={i} position={[pos.x, pos.y, groupBaseZ]} rotation={[0, 0, rotZ]}>
            <SnapClipPart material={material} />
          </group>
        );
      })}
    </group>
  );
}
