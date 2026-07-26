/**
 * 3D overhang extension for bins in the isometric preview (#2462).
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
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';
import { buildBinOverhangStrips } from './binOverhangStrips';
import type { OverhangStrip } from './binOverhangStrips';

interface BinOverhangExtensionsProps {
  bins: readonly BinRenderData[];
  drawerWidth: number;
  drawerDepth: number;
}

interface ColoredStrip extends OverhangStrip {
  readonly color: string;
  readonly opacity: number;
}

export function BinOverhangExtensions({ bins, drawerWidth, drawerDepth }: BinOverhangExtensionsProps) {
  const { baseplate, gridUnitMm } = useLayoutStore(
    useShallow((s) => ({
      baseplate: s.layout.baseplateParams,
      gridUnitMm: s.layout.gridUnitMm,
    }))
  );

  const strips = useMemo<ColoredStrip[]>(() => {
    return bins.flatMap((bd) =>
      buildBinOverhangStrips(
        {
          id: bd.bin.id,
          x: bd.x,
          y: bd.y,
          z: bd.z,
          width: bd.bin.width,
          depth: bd.bin.depth,
          height: bd.height,
          extendToMargin: bd.bin.extendToMargin,
          overhang: bd.bin.overhang,
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
