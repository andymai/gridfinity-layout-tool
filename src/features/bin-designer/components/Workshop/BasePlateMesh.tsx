/**
 * Proxy for the Gridfinity base: a plate the size of the socket stack plus
 * the floor. The exact socket profile comes from the worker once the
 * assembly generator lands; this stands in so parts have a surface to sit on.
 */
import { useEffect, useMemo, useRef } from 'react';
import { ExtrudeGeometry, Shape } from 'three';
import type { Vector3 } from 'three';
import type { MeshStandardMaterial } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
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
  /** Sharp worker mesh is on screen — render nothing, keep raycast alive. */
  hidden?: boolean;
  /** performance.now() of the last armed click that missed every surface. */
  flashAt?: number;
  onSurfaceMove: (surface: HoverSurface) => void;
  onSurfaceLeave: () => void;
  onSurfaceClick: (surface: HoverSurface) => void;
  /** World → flat placement frame (identity unless the base is wedged). */
  sceneFromWorld?: (point: Vector3) => Vector3;
}

const FLASH_MS = 350;

export function BasePlateMesh({
  envelope,
  base,
  hidden = false,
  flashAt = 0,
  onSurfaceMove,
  onSurfaceLeave,
  onSurfaceClick,
  sceneFromWorld,
}: BasePlateMeshProps) {
  const colors = useThreeColors();
  const materialRef = useRef<MeshStandardMaterial>(null);
  const flashDirtyRef = useRef(false);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (flashAt > 0) invalidate();
  }, [flashAt, invalidate]);

  // Missed-placement pulse. Driven imperatively so the demand-mode canvas
  // only renders while flashing; while the sharp mesh hides the plate, the
  // pulse borrows visibility briefly and fades back out.
  useFrame(() => {
    const material = materialRef.current;
    if (!material || flashAt === 0) return;
    const t = (performance.now() - flashAt) / FLASH_MS;
    if (t >= 1) {
      if (flashDirtyRef.current) {
        flashDirtyRef.current = false;
        material.emissiveIntensity = 0;
        material.opacity = 1;
        material.transparent = false;
        material.visible = !hidden;
        invalidate();
      }
      return;
    }
    flashDirtyRef.current = true;
    material.visible = true;
    material.emissiveIntensity = 0.35 * (1 - t);
    if (hidden) {
      material.transparent = true;
      material.opacity = 0.35 * (1 - t);
    } else {
      material.transparent = false;
      material.opacity = 1;
    }
    invalidate();
  });
  const { w: fullW, d: fullD } = baseExtentMm(envelope);
  const wedgeAngle = base.wedge !== undefined && base.wedge.angleDeg > 0 ? base.wedge.angleDeg : 0;
  // Wedge mode: the socket and plinth render flat outside the tilt group
  // (WedgeFillerMesh); this mesh becomes just the deck, inset like the
  // worker's so its leaning walls stay inside the plinth.
  const deckInset =
    wedgeAngle > 0 ? base.floorThickness * Math.sin((wedgeAngle * Math.PI) / 180) + 0.6 : 0;
  const w = fullW - 2 * deckInset;
  const d = fullD - 2 * deckInset;
  const plateHeight =
    wedgeAngle > 0 ? base.floorThickness : GRIDFINITY_SPEC.SOCKET_HEIGHT + base.floorThickness;
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

  const toSurface = (e: ThreeEvent<PointerEvent | MouseEvent>): HoverSurface => {
    const local = sceneFromWorld ? sceneFromWorld(e.point) : e.point;
    return {
      parentId: null,
      topZ: 0,
      x: sceneToStore(local.x, fullW),
      y: sceneToStore(local.y, fullD),
    };
  };

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
      <meshStandardMaterial
        ref={materialRef}
        visible={!hidden}
        color={colors.workshopBase}
        roughness={0.85}
        metalness={0.05}
        emissive={colors.workshopGhost}
        emissiveIntensity={0}
      />
    </mesh>
  );
}
