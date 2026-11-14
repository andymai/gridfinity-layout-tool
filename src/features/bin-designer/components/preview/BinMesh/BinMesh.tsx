/**
 * Renders generated bin geometry as a Three.js mesh with PBR material.
 * Uses scene lighting (hemisphere + directional) for natural shading
 * with FrontSide face culling for correct visibility.
 *
 * Features:
 * - Dynamic flat shading for large bins (GPU-computed normals)
 * - Pre-computed BREP edge lines from worker (avoids main-thread EdgesGeometry)
 * - polygonOffset to prevent z-fighting with edge lines
 * - Per-corner lip coloring: lip face groups are sub-grouped by triangle
 *   centroid quadrant relative to the lip's outer bbox center.
 */

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { LineBasicMaterial } from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { Detailed } from '@react-three/drei';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useShallow } from 'zustand/react/shallow';
import { useCoarseGeometry } from '@/shared/components/preview/useMeshGeometry';
import { useZoneColoredMesh } from '@/features/bin-designer/hooks/useZoneColoredMesh';
import type { ZoneClickHandler } from '@/features/bin-designer/hooks/useZoneColoredMesh';
import { nextEdgeFade } from './edgeFade';

const EDGE_COLOR = '#000000';

/** Edge-overlay fade-in duration after a Manifold draft (edges popping in at
 * full strength is the most jarring part of the draft→exact swap). */
const EDGE_FADE_MS = 250;

/** Finalize fade starts from this opacity (not 0) so already-visible draft
 *  edges never blink to invisible when the final swaps in. */
const EDGE_FINALIZE_FADE_FLOOR = 0.55;

interface BinMeshProps {
  wireframe: boolean;
  /** Base color for the bin (user-selectable) */
  color: string;
  /** When true, render with ghosted faces so internal geometry shows through. */
  xray?: boolean;
  /**
   * Click handler invoked when a color tool is active. `screen` is in
   * viewport coordinates (clientX/clientY) so the parent can anchor a
   * popover at the click point. Only fired when `ui.colorTool` is set.
   */
  onZoneClick?: ZoneClickHandler;
}

export function BinMesh({ wireframe, color, xray = false, onZoneClick }: BinMeshProps) {
  const { invalidate } = useThree();

  const { vertices, normals, indices, edgeVertices, isDraft, faceGroups, coarseLOD } =
    useDesignerStore(
      useShallow((s) => ({
        vertices: s.generation.mesh?.vertices ?? null,
        normals: s.generation.mesh?.normals ?? null,
        indices: s.generation.mesh?.indices ?? null,
        edgeVertices: s.generation.mesh?.edgeVertices ?? null,
        isDraft: s.generation.isDraft,
        faceGroups: s.generation.mesh?.faceGroups ?? null,
        coarseLOD: s.generation.mesh?.coarseLOD ?? null,
      }))
    );

  // Drafts ship clean dihedral crease edges from the worker (see
  // creaseEdges.ts), so they render directly instead of being recomputed on
  // the main thread every draft tick.
  const { geometry, edgesGeometry, materials, singleMatProps, meshProps } = useZoneColoredMesh({
    vertices,
    normals,
    indices,
    edgeVertices,
    faceGroups,
    wireframe,
    xray,
    color,
    onZoneClick,
  });

  const coarseGeometry = useCoarseGeometry(coarseLOD);

  // Fade the edge overlay in whenever it (re)appears, and gently fade on the
  // draft→final swap (already-visible edges never blink to invisible). The
  // canvas renders on demand, so keep invalidating while the fade runs.
  const edgeMatRef = useRef<LineBasicMaterial>(null);
  const edgeFadeStartRef = useRef<number | null>(null);
  const hadEdgesRef = useRef(false);
  const prevIsDraftRef = useRef(false);
  const fadeFromRef = useRef(0);
  useLayoutEffect(() => {
    const hasEdges = edgesGeometry !== null;
    const kind = nextEdgeFade({
      prevHadEdges: hadEdgesRef.current,
      hasEdges,
      prevIsDraft: prevIsDraftRef.current,
      isDraft,
    });
    if (kind !== null) {
      fadeFromRef.current = kind === 'finalize' ? EDGE_FINALIZE_FADE_FLOOR : 0;
      edgeFadeStartRef.current = performance.now();
      if (edgeMatRef.current) {
        edgeMatRef.current.transparent = true;
        edgeMatRef.current.opacity = fadeFromRef.current;
      }
      invalidate();
    }
    hadEdgesRef.current = hasEdges;
    prevIsDraftRef.current = isDraft;
  }, [edgesGeometry, isDraft, invalidate]);
  useFrame(() => {
    const start = edgeFadeStartRef.current;
    const mat = edgeMatRef.current;
    if (start === null || !mat) return;
    const t = Math.min(1, (performance.now() - start) / EDGE_FADE_MS);
    const eased = t * (2 - t); // ease-out
    const from = fadeFromRef.current;
    mat.opacity = from + (1 - from) * eased;
    if (t >= 1) {
      edgeFadeStartRef.current = null;
      mat.transparent = false;
      mat.opacity = 1;
    } else {
      invalidate();
    }
  });

  // Invalidate when coarse geometry changes (LOD needs re-render)
  useEffect(() => {
    if (coarseGeometry) invalidate();
  }, [coarseGeometry, invalidate]);

  if (!geometry) return null;

  // Distinct keys force unmount/remount across the multi↔single switch. If we
  // reuse the same <mesh>, R3F's prop-diff resets the removed `material` prop
  // to a memoized MeshBasicMaterial after the child-material attach has run,
  // clobbering the new material — no emissive glow, color picker stuck.
  const fineMesh = materials ? (
    <mesh key="multi-color" geometry={geometry} material={materials} {...meshProps} />
  ) : (
    <mesh key="single-color" geometry={geometry} {...meshProps}>
      <meshStandardMaterial {...singleMatProps} />
    </mesh>
  );

  return (
    <group position={[0, 0, 0.1]}>
      {coarseGeometry ? (
        <Detailed distances={[0, 300]}>
          {fineMesh}
          <mesh geometry={coarseGeometry}>
            <meshStandardMaterial {...singleMatProps} flatShading />
          </mesh>
        </Detailed>
      ) : (
        fineMesh
      )}
      {!wireframe && edgesGeometry && (
        <lineSegments geometry={edgesGeometry} renderOrder={1}>
          <lineBasicMaterial ref={edgeMatRef} color={EDGE_COLOR} depthTest={true} />
        </lineSegments>
      )}
    </group>
  );
}
