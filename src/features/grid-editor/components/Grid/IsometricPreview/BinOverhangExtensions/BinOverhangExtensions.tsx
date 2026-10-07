/**
 * 3D overhang extension for bins in the isometric preview.
 *
 * Renders decorative solid strips filling the space around each extended bin
 * (see `binOverhangStrips`). Kept separate from the merged bin geometry / cache /
 * transition pipeline so it can't regress it; the strip count is tiny (only
 * bins that actually extend). Deliberately does NOT gate on a configured
 * baseplate — an explicit "Expand to Fit" overhang exists independently of one.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store';
import { effectiveGridUnitMmY } from '@/core/types';
import type { DesignId } from '@/core/types';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';
import { useLinkedDesignKinds } from '@/shared/hooks/useLinkedDesignKinds';
import { designEntryFor } from '../LinkedBinMeshes/placement';
import type { DesignGeometryEntry } from '../LinkedBinMeshes/useDesignGeometries';
import { buildBinOverhangStrips } from './binOverhangStrips';
import type { OverhangStrip } from './binOverhangStrips';

interface BinOverhangExtensionsProps {
  bins: readonly BinRenderData[];
  drawerWidth: number;
  drawerDepth: number;
  /** Resolved design meshes; a bin drawn with one hangs its strips from its body. */
  designGeometries: Map<DesignId, DesignGeometryEntry>;
}

interface ColoredStrip extends OverhangStrip {
  readonly color: string;
  readonly opacity: number;
}

export function BinOverhangExtensions({
  bins,
  drawerWidth,
  drawerDepth,
  designGeometries,
}: BinOverhangExtensionsProps) {
  const { baseplate, gridUnitMm, gridUnitMmY } = useLayoutStore(
    useShallow((s) => ({
      baseplate: s.layout.baseplateParams,
      gridUnitMm: s.layout.gridUnitMm,
      gridUnitMmY: effectiveGridUnitMmY(s.layout),
    }))
  );
  const designKinds = useLinkedDesignKinds();

  const strips = useMemo<ColoredStrip[]>(() => {
    return bins.flatMap((bd) => {
      const bodyBaseMm = designEntryFor(bd, designGeometries)?.bodyBaseMm ?? 0;
      const linkedId = bd.bin.linkedDesignId;
      return buildBinOverhangStrips(
        {
          id: bd.bin.id,
          x: bd.x,
          y: bd.y,
          z: bd.z,
          width: bd.bin.width,
          depth: bd.bin.depth,
          height: bd.height,
          bodyBase: bodyBaseMm / gridUnitMm,
          extendToMargin: bd.bin.extendToMargin,
          overhang: bd.bin.overhang,
          linkedKind: linkedId === undefined ? undefined : designKinds.get(linkedId),
        },
        drawerWidth,
        drawerDepth,
        baseplate,
        gridUnitMm,
        gridUnitMmY
      ).map((s) => ({ ...s, color: bd.color, opacity: bd.opacity }));
    });
  }, [
    baseplate,
    gridUnitMm,
    gridUnitMmY,
    bins,
    drawerWidth,
    drawerDepth,
    designGeometries,
    designKinds,
  ]);

  if (strips.length === 0) return null;

  return (
    <>
      {strips.map((s) => (
        <mesh key={s.key} position={s.position as [number, number, number]}>
          <boxGeometry args={s.size as [number, number, number]} />
          <meshStandardMaterial
            color={s.color}
            roughness={0.4}
            metalness={0}
            transparent={s.opacity < 1}
            opacity={s.opacity}
            depthWrite={s.opacity === 1}
            side={THREE.DoubleSide}
            emissive={s.color}
            emissiveIntensity={0.15}
          />
        </mesh>
      ))}
    </>
  );
}
