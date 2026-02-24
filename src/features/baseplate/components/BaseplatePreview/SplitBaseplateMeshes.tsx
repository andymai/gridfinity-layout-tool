/**
 * Multi-piece Three.js renderer for split baseplates.
 *
 * Positions each piece at its grid offset in assembled mode, or adds
 * explode gaps between pieces in exploded mode for visual clarity.
 * Each piece is rendered with its own geometry from the worker-generated mesh.
 */

import { useMemo, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { EXPLODE_GAP_MM } from '../../constants';
import type { PieceMeshEntry } from '../../store/baseplatePageStore';

interface PieceMeshProps {
  readonly entry: PieceMeshEntry;
  readonly color: string;
  readonly totalWidthMm: number;
  readonly totalDepthMm: number;
  readonly explodeX: number;
  readonly explodeY: number;
}

/** Renders a single piece mesh with position offset. */
function PieceMesh({
  entry,
  color,
  totalWidthMm,
  totalDepthMm,
  explodeX,
  explodeY,
}: PieceMeshProps) {
  const { invalidate } = useThree();
  const { vertices, normals, indices, edgeVertices } = entry.mesh;
  const hasPrecomputedNormals = normals !== null && normals.length > 0;

  const geometry = useMemo(() => {
    if (!vertices || vertices.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    if (indices && indices.length > 0) {
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
    }

    if (hasPrecomputedNormals) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    } else {
      geo.computeVertexNormals();
    }

    return geo;
  }, [vertices, normals, indices, hasPrecomputedNormals]);

  const edgesGeometry = useMemo(() => {
    if (!edgeVertices || edgeVertices.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3));
    return geo;
  }, [edgeVertices]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      edgesGeometry?.dispose();
    };
  }, [geometry, edgesGeometry]);

  useEffect(() => {
    if (geometry) invalidate();
  }, [geometry, invalidate]);

  if (!geometry) return null;

  // Position: piece's grid center relative to the total baseplate center
  const GS = GRIDFINITY_SPEC.GRID_SIZE;
  const pieceWidthMm = entry.widthUnits * GS;
  const pieceDepthMm = entry.depthUnits * GS;
  const pieceCenterX = entry.offsetX * GS + pieceWidthMm / 2 - totalWidthMm / 2;
  const pieceCenterY = entry.offsetY * GS + pieceDepthMm / 2 - totalDepthMm / 2;

  const x = pieceCenterX + explodeX;
  const y = pieceCenterY + explodeY;

  return (
    <group position={[x, y, 0.1]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={color}
          roughness={0.45}
          metalness={0}
          side={THREE.DoubleSide}
          emissive={color}
          emissiveIntensity={0.08}
          flatShading={!hasPrecomputedNormals}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      {edgesGeometry && (
        <lineSegments geometry={edgesGeometry} renderOrder={1}>
          <lineBasicMaterial color="#000000" />
        </lineSegments>
      )}
    </group>
  );
}

interface SplitBaseplateMeshesProps {
  readonly color: string;
  readonly totalWidthUnits: number;
  readonly totalDepthUnits: number;
}

/**
 * Renders all pieces of a split baseplate with assembled or exploded positioning.
 */
export function SplitBaseplateMeshes({
  color,
  totalWidthUnits,
  totalDepthUnits,
}: SplitBaseplateMeshesProps) {
  const { pieceMeshes, splitViewMode } = useBaseplatePageStore(
    useShallow((s) => ({
      pieceMeshes: s.pieceMeshes,
      splitViewMode: s.splitViewMode,
    }))
  );

  const GS = GRIDFINITY_SPEC.GRID_SIZE;
  const totalWidthMm = totalWidthUnits * GS;
  const totalDepthMm = totalDepthUnits * GS;

  return (
    <>
      {pieceMeshes.map((entry) => {
        const explodeX = splitViewMode === 'exploded' ? entry.col * EXPLODE_GAP_MM : 0;
        const explodeY = splitViewMode === 'exploded' ? entry.row * EXPLODE_GAP_MM : 0;

        return (
          <PieceMesh
            key={entry.label}
            entry={entry}
            color={color}
            totalWidthMm={totalWidthMm}
            totalDepthMm={totalDepthMm}
            explodeX={explodeX}
            explodeY={explodeY}
          />
        );
      })}
    </>
  );
}
