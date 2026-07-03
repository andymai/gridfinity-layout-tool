/**
 * Translucent wall highlight for the overhang section.
 *
 * When an overhang slider (or the feet toggle) is hovered/focused in the panel,
 * `ui.hoveredOverhangSide` is set and this overlay lights up the matching wall —
 * a flush face at 0mm, growing into a band as the slider increases — so the user
 * can see which side a control affects. Mirrors the hoveredColorZone glow path.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { computeOverhangHighlightBoxes } from './overhangHighlightGeometry';

const HIGHLIGHT_COLOR = '#fbbf24';
const HIGHLIGHT_OPACITY = 0.3;

const ZERO_OVERHANG = { left: 0, right: 0, front: 0, back: 0 } as const;

export function OverhangHighlight() {
  const { invalidate } = useThree();

  const {
    side,
    width,
    depth,
    height,
    gridUnitMm,
    gridUnitMmY,
    heightUnitMm,
    stackingLip,
    baseStyle,
    overhang,
  } = useDesignerStore(
    useShallow((s) => ({
      side: s.ui.hoveredOverhangSide,
      width: s.params.width,
      depth: s.params.depth,
      height: s.params.height,
      gridUnitMm: s.params.gridUnitMm,
      gridUnitMmY: s.params.gridUnitMmY,
      heightUnitMm: s.params.heightUnitMm,
      stackingLip: s.params.base.stackingLip,
      baseStyle: s.params.base.style,
      overhang: s.params.overhang ?? ZERO_OVERHANG,
    }))
  );
  // Y axis uses gridUnitMmY when set (non-square grid); equals X for square.
  const gridUnitMmYEff = gridUnitMmY ?? gridUnitMm;

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(HIGHLIGHT_COLOR),
        transparent: true,
        opacity: HIGHLIGHT_OPACITY,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    []
  );

  useEffect(() => () => material.dispose(), [material]);

  const boxes = useMemo(() => {
    if (!side) return [];
    const outerW = width * gridUnitMm - GRIDFINITY.TOLERANCE;
    const outerD = depth * gridUnitMmYEff - GRIDFINITY.TOLERANCE;
    // The overhang's flat bottom sits at the socket top (feet stay put); a flat
    // base has no socket, so it starts at z=0. Top includes the stacking lip.
    const wallBottomZ = baseStyle === 'flat' ? 0 : GRIDFINITY.SOCKET_HEIGHT;
    const wallTopZ = height * heightUnitMm + (stackingLip ? GRIDFINITY.LIP_HEIGHT : 0);
    return computeOverhangHighlightBoxes(side, {
      outerW,
      outerD,
      wallBottomZ,
      wallTopZ,
      overhang: {
        left: overhang.left,
        right: overhang.right,
        front: overhang.front,
        back: overhang.back,
      },
    });
  }, [
    side,
    width,
    depth,
    height,
    gridUnitMm,
    gridUnitMmYEff,
    heightUnitMm,
    stackingLip,
    baseStyle,
    overhang,
  ]);

  // frameloop is "demand" — nudge a render whenever the highlight changes or clears.
  useEffect(() => {
    invalidate();
  }, [boxes, invalidate]);

  if (!side || boxes.length === 0) return null;

  return (
    <group renderOrder={3}>
      {boxes.map((box, i) => (
        <mesh
          key={`${side}-${i}`}
          position={box.center as [number, number, number]}
          material={material}
          renderOrder={3}
        >
          <boxGeometry args={box.size as [number, number, number]} />
        </mesh>
      ))}
    </group>
  );
}
