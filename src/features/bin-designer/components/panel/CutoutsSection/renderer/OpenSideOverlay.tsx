/**
 * Draws each open-sided pocket's channel out through the wall on the editor
 * canvas, so a rectangle with an open side reads as a slot that leaves the
 * block rather than a pocket sitting near its edge. See openSideOverlayGeometry.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import type { Cutout } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import { ACCENT_COLOR_HEX, RENDER_ORDER } from './constants';
import { loopToSegmentPositions } from './knifeSlotOverlayGeometry';
import { openSideOverlayLoops } from './openSideOverlayGeometry';

const OUTLINE_OPACITY = 0.8;
const FILL_OPACITY = 0.18;
/** Just under the pointer-catching shapes, just over the fills. */
const OVERLAY_Z = 0.045;

interface OpenSideOverlayProps {
  readonly cutouts: readonly Cutout[];
  readonly binWidth: number;
  readonly binDepth: number;
}

export function OpenSideOverlay({ cutouts, binWidth, binDepth }: OpenSideOverlayProps) {
  const base = useDesignerStore((s) => s.params.base);
  const overhang = useDesignerStore((s) => s.params.overhang);
  const cellMask = useDesignerStore((s) => s.params.cellMask);
  const wallThickness = useDesignerStore((s) => s.params.wallThickness);

  const geometries = useMemo(() => {
    const outline: number[] = [];
    const fill: number[] = [];
    const host = { base, overhang, cellMask };
    const frame = { binWidth, binDepth, wallThickness };
    for (const cutout of cutouts) {
      for (const loop of openSideOverlayLoops(cutout, host, frame)) {
        outline.push(...loopToSegmentPositions(loop, OVERLAY_Z));
        const [a, b, c, d] = loop;
        fill.push(...a, OVERLAY_Z, ...b, OVERLAY_Z, ...c, OVERLAY_Z);
        fill.push(...a, OVERLAY_Z, ...c, OVERLAY_Z, ...d, OVERLAY_Z);
      }
    }
    if (outline.length === 0) return null;
    const lines = new THREE.BufferGeometry();
    lines.setAttribute('position', new THREE.Float32BufferAttribute(outline, 3));
    const faces = new THREE.BufferGeometry();
    faces.setAttribute('position', new THREE.Float32BufferAttribute(fill, 3));
    return { lines, faces };
  }, [cutouts, base, overhang, cellMask, binWidth, binDepth, wallThickness]);

  const materials = useMemo(
    () => ({
      line: new THREE.LineBasicMaterial({
        color: new THREE.Color(ACCENT_COLOR_HEX),
        transparent: true,
        opacity: OUTLINE_OPACITY,
        depthTest: false,
      }),
      fill: new THREE.MeshBasicMaterial({
        color: new THREE.Color(ACCENT_COLOR_HEX),
        transparent: true,
        opacity: FILL_OPACITY,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    }),
    []
  );

  useEffect(
    () => () => {
      geometries?.lines.dispose();
      geometries?.faces.dispose();
    },
    [geometries]
  );
  useEffect(
    () => () => {
      materials.line.dispose();
      materials.fill.dispose();
    },
    [materials]
  );

  const objects = useMemo(() => {
    if (!geometries) return null;
    const segments = new THREE.LineSegments(geometries.lines, materials.line);
    const mesh = new THREE.Mesh(geometries.faces, materials.fill);
    // Just under the drawing preview, above the shape fills.
    segments.renderOrder = RENDER_ORDER.DRAWING_PREVIEW - 1;
    mesh.renderOrder = RENDER_ORDER.DRAWING_PREVIEW - 2;
    return { segments, mesh };
  }, [geometries, materials]);
  if (!objects) return null;
  return (
    <>
      <primitive object={objects.mesh} raycast={() => {}} />
      <primitive object={objects.segments} raycast={() => {}} />
    </>
  );
}
