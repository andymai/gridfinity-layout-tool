/**
 * The magnet bosses a lid cutout has to leave intact.
 *
 * A magnetic lid hangs a retention boss under its plate at each magnet, and the
 * worker subtracts those from every hole it cuts (`buildClipBoundary`). Without
 * a cue the shape draws as if it will cut cleanly and the printed part comes out
 * with an unexplained disc-shaped island in the middle of the slot. The hint
 * copy has been promising this behaviour ("They stay clear of the mating wall
 * and the magnet bosses") without ever showing it.
 *
 * Drawn as scenery, like `ReferenceOutline3D`: a faint disc with a slightly
 * firmer edge, under every shape so it reads as "material stays here" rather
 * than as a boundary the pointer will resist. The shape that overlaps one is
 * flagged separately, through the same off-board affordance as any other clip.
 *
 * Positions arrive in the WINDOW frame (`lidCutoutWindow` rebases them), which
 * is the frame the canvas already draws in: origin (0,0) at the front-left
 * corner, mm, Y-up.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { LidCutoutKeepout } from '@/shared/utils/lidCutoutPlan';
import { RENDER_ORDER, REFERENCE_OUTLINE_COLOR } from './constants';

/** Enough segments that a ~5mm boss reads as a circle at any usable zoom. */
const SEGMENTS = 48;

/** Just above the background, below the reference outline and every shape. */
const Z = 0.015;

interface KeepoutCircles3DProps {
  readonly keepouts: readonly LidCutoutKeepout[];
}

export function KeepoutCircles3D({ keepouts }: KeepoutCircles3DProps) {
  // The disposables are collected as they are built rather than recovered by
  // traversing afterwards: a traversal has to narrow `Object3D` back down to
  // something with a geometry, and what it gets back is untyped.
  const { group, disposables } = useMemo(() => {
    const root = new THREE.Group();
    const owned: Array<THREE.BufferGeometry | THREE.Material> = [];
    const color = new THREE.Color(REFERENCE_OUTLINE_COLOR);

    for (const k of keepouts) {
      const fillGeometry = new THREE.CircleGeometry(k.r, SEGMENTS);
      const fillMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.18,
        depthTest: false,
      });
      const fill = new THREE.Mesh(fillGeometry, fillMaterial);
      fill.position.set(k.x, k.y, Z);
      fill.renderOrder = RENDER_ORDER.REFERENCE_OUTLINE;
      root.add(fill);
      owned.push(fillGeometry, fillMaterial);

      const points: THREE.Vector3[] = [];
      for (let i = 0; i < SEGMENTS; i++) {
        const a = (i / SEGMENTS) * Math.PI * 2;
        points.push(new THREE.Vector3(k.x + k.r * Math.cos(a), k.y + k.r * Math.sin(a), Z));
      }
      const edgeGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const edgeMaterial = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.5,
        depthTest: false,
      });
      const edge = new THREE.LineLoop(edgeGeometry, edgeMaterial);
      edge.renderOrder = RENDER_ORDER.REFERENCE_OUTLINE;
      root.add(edge);
      owned.push(edgeGeometry, edgeMaterial);
    }

    return { group: root, disposables: owned };
  }, [keepouts]);

  // <primitive> does not auto-dispose attached objects; release the GPU
  // resources when the group is replaced or the component unmounts.
  useEffect(
    () => () => {
      for (const d of disposables) d.dispose();
    },
    [disposables]
  );

  if (keepouts.length === 0) return null;
  return <primitive object={group} />;
}
