/**
 * Proxy for the Gridfinity base: a plate the size of the socket stack plus
 * the floor. The exact socket profile comes from the worker once the
 * assembly generator lands; this stands in so parts have a surface to sit on.
 */
import { useEffect, useMemo } from 'react';
import { ExtrudeGeometry, Shape } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import type { ItemEnvelope } from '@/shared/types/item';
import type { AssemblyBase } from '@/shared/types/assembly';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { baseExtentMm, sceneToStore } from './workshopPlacement';
import type { HoverSurface } from './useWorkshopInteraction';

interface BasePlateMeshProps {
  envelope: ItemEnvelope;
  base: AssemblyBase;
  onSurfaceMove: (surface: HoverSurface) => void;
  onSurfaceLeave: () => void;
  onSurfaceClick: (surface: HoverSurface) => void;
}

export function BasePlateMesh({
  envelope,
  base,
  onSurfaceMove,
  onSurfaceLeave,
  onSurfaceClick,
}: BasePlateMeshProps) {
  const colors = useThreeColors();
  const { w, d } = baseExtentMm(envelope);
  const plateHeight = GRIDFINITY_SPEC.BASE_HEIGHT + base.floorThickness;
  const cornerRadius = Math.min(base.cornerRadius ?? 4, w / 2, d / 2);

  const geometry = useMemo(() => {
    const shape = new Shape();
    const r = cornerRadius;
    shape.moveTo(-w / 2 + r, -d / 2);
    shape.lineTo(w / 2 - r, -d / 2);
    shape.absarc(w / 2 - r, -d / 2 + r, r, -Math.PI / 2, 0, false);
    shape.lineTo(w / 2, d / 2 - r);
    shape.absarc(w / 2 - r, d / 2 - r, r, 0, Math.PI / 2, false);
    shape.lineTo(-w / 2 + r, d / 2);
    shape.absarc(-w / 2 + r, d / 2 - r, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(-w / 2, -d / 2 + r);
    shape.absarc(-w / 2 + r, -d / 2 + r, r, Math.PI, Math.PI * 1.5, false);
    shape.closePath();
    const g = new ExtrudeGeometry(shape, { depth: plateHeight, bevelEnabled: false });
    g.translate(0, 0, -plateHeight);
    return g;
  }, [w, d, plateHeight, cornerRadius]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const toSurface = (e: ThreeEvent<PointerEvent | MouseEvent>): HoverSurface => ({
    parentId: null,
    topZ: 0,
    x: sceneToStore(e.point.x, w),
    y: sceneToStore(e.point.y, d),
  });

  return (
    <mesh
      geometry={geometry}
      onPointerMove={(e) => {
        e.stopPropagation();
        onSurfaceMove(toSurface(e));
      }}
      onPointerLeave={onSurfaceLeave}
      onClick={(e) => {
        e.stopPropagation();
        onSurfaceClick(toSurface(e));
      }}
    >
      <meshStandardMaterial color={colors.workshopBase} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}
