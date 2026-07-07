/**
 * 3D drawer-margin extension for bins in the isometric preview (#2462).
 *
 * Renders decorative solid strips filling the margin around each extended bin
 * (see `binMarginStrips`). Kept separate from the merged bin geometry / cache /
 * transition pipeline so it can't regress it; the strip count is tiny (only
 * extended edge bins). Self-gates on a configured baseplate.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';
import { buildBinMarginStrips } from './binMarginStrips';
import type { MarginStrip } from './binMarginStrips';

interface BinMarginExtensionsProps {
  bins: readonly BinRenderData[];
  drawerWidth: number;
  drawerDepth: number;
}

interface ColoredStrip extends MarginStrip {
  readonly color: string;
  readonly opacity: number;
}

export function BinMarginExtensions({ bins, drawerWidth, drawerDepth }: BinMarginExtensionsProps) {
  const { baseplate, gridUnitMm } = useLayoutStore(
    useShallow((s) => ({
      baseplate: s.layout.baseplateParams,
      gridUnitMm: s.layout.gridUnitMm,
    }))
  );

  const strips = useMemo<ColoredStrip[]>(() => {
    if (!baseplate) return [];
    return bins.flatMap((bd) =>
      buildBinMarginStrips(
        {
          id: bd.bin.id,
          x: bd.x,
          y: bd.y,
          z: bd.z,
          width: bd.bin.width,
          depth: bd.bin.depth,
          height: bd.height,
          extendToMargin: bd.bin.extendToMargin,
        },
        drawerWidth,
        drawerDepth,
        baseplate,
        gridUnitMm
      ).map((s) => ({ ...s, color: bd.color, opacity: bd.opacity }))
    );
  }, [baseplate, gridUnitMm, bins, drawerWidth, drawerDepth]);

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
