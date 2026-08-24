/**
 * Ghost outlines for the LID's through-cuts, drawn on the lid in the 3D preview.
 *
 * The bin's interior gets this from `GhostCutouts`; without a lid equivalent the
 * lid board is the one editor surface with no 3D companion — you draw a
 * dispensing slot and the preview shows an unbroken plate until the worker
 * finishes.
 *
 * Two things make it a separate component rather than a branch inside
 * `GhostCutouts`:
 *
 * - The frame. Bin cutouts are placed against the overhang-expanded interior;
 *   lid cutouts against the mating-cavity window from `lidCutoutPlan`, which is
 *   neither that nor the lid's outer plate.
 * - The transform. The lid is a separate solid that sits at `lipTopZ - anchorZ`
 *   and rides the explode slider, so these outlines have to travel with it. They
 *   are built in LID-LOCAL Z and the group carries them, exactly as `LidMesh`
 *   does — deriving a world Z here instead would be a second copy of the mating
 *   arithmetic that CLAUDE.md gotcha #14 is about.
 */

import { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { useDesignerStore, useCutoutSelection } from '@/features/bin-designer/store';
import { useLineMaterialResolution } from '../useLineMaterialResolution';
import { lidGroupPosition } from '../LidMesh/lidAnchorZ';
import { lidCutoutHostFace, lidCutoutWindow } from '@/shared/utils/lidCutoutPlan';
import type { Cutout } from '@/features/bin-designer/types';
import { buildCutoutGeometry } from '../GhostCutouts/ghostCutoutGeometry';

/** Matches the bin's cutout ghost so the two read as one language. */
const GHOST_COLOR = '#fbbf24';
const GHOST_OPACITY = 0.6;
const LINE_WIDTH = 2;

interface GhostLidCutoutsProps {
  /** Distance the lid is lifted above its mated position, in mm. 0 = closed. */
  readonly lidOffsetMm: number;
}

export function GhostLidCutouts({ lidOffsetMm }: GhostLidCutoutsProps) {
  const { invalidate } = useThree();
  const lineRef = useRef<LineSegments2 | null>(null);

  const { params, generationStatus } = useDesignerStore(
    useShallow((s) => ({ params: s.params, generationStatus: s.generation.status }))
  );
  const selectedIds = useCutoutSelection((s) => s.selectedIds);
  const previewOverrides = useCutoutSelection((s) => s.previewOverrides);

  // Null whenever a gate refuses the lid its cutouts, so a design that cannot
  // carry them draws nothing rather than drawing them somewhere plausible.
  const window = lidCutoutWindow(params);
  // Memoized: absent-when-empty means a fresh `[]` each render would invalidate
  // the memo below on every frame.
  const cutouts = useMemo(() => params.lid.cutouts ?? [], [params.lid.cutouts]);

  // The SAME placement the mesh uses, from the same helper — including the
  // explode translation, which for a sliding lid runs along its entry axis
  // rather than upward. Re-deriving it here is how a ghost ends up drawn
  // somewhere the part is not.
  const lidPosition = lidGroupPosition(params, lidOffsetMm);

  const isGenerating = generationStatus === 'generating';
  const hasSelection = selectedIds.size > 0;

  const cutoutsToRender = useMemo(() => {
    if (!window || cutouts.length === 0) return [];
    // Same rule as the bin ghosts: no outline for a shape the worker drops.
    const visible = cutouts.filter((c) => c.hidden !== true);
    let result: readonly Cutout[];
    if (isGenerating) {
      result = visible;
    } else if (hasSelection) {
      // Selection is shared with the bin's board, and ids are UUIDs, so this
      // matches nothing unless the lid is the one being edited.
      result = visible.filter((c) => selectedIds.has(c.id));
    } else {
      return [];
    }
    if (result.length === 0) return result;
    // The depth the WORKER will use, not the stored one: a lid cutout always
    // spans the plate, so a ghost drawn at `cutDepth` would promise a pocket.
    // Lean is zeroed for the same reason — the lid builder bores straight
    // through and strips it, so a tilted ghost would promise a tilted hole.
    const host = lidCutoutHostFace(params);
    return result.map((c) => {
      const overrides = previewOverrides.get(c.id);
      return { ...c, ...overrides, cutDepth: host.thickness, leanDeg: 0 };
    });
  }, [window, cutouts, isGenerating, hasSelection, selectedIds, previewOverrides, params]);

  const geometry = useMemo(() => {
    if (!window || cutoutsToRender.length === 0) return null;
    const originX = window.offsetX - window.spanW / 2;
    const originY = window.offsetY - window.spanD / 2;
    return buildCutoutGeometry(cutoutsToRender, originX, originY, lidCutoutHostFace(params).topZ);
  }, [window, cutoutsToRender, params]);

  const material = useMemo(() => {
    if (!geometry) return null;
    return new LineMaterial({
      color: new THREE.Color(GHOST_COLOR).getHex(),
      linewidth: LINE_WIDTH,
      transparent: true,
      opacity: GHOST_OPACITY,
      // Through the lid's own plate, so the far outline stays readable when the
      // lid is closed over the bin.
      depthTest: false,
      depthWrite: false,
      resolution: new THREE.Vector2(),
    });
  }, [geometry]);

  useLineMaterialResolution(material);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  }, [geometry, material]);

  useEffect(() => {
    if (geometry && material) invalidate();
  }, [geometry, material, invalidate]);

  const lineSegments = useMemo(
    () => (geometry && material ? new LineSegments2(geometry, material) : null),
    [geometry, material]
  );

  if (!lineSegments) return null;

  return (
    <primitive
      ref={lineRef}
      object={lineSegments}
      position={[lidPosition[0], lidPosition[1], lidPosition[2]]}
    />
  );
}
