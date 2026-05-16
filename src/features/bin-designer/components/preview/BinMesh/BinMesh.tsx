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

import { useCallback, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Detailed } from '@react-three/drei';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useShallow } from 'zustand/react/shallow';
import { useMeshGeometry, useCoarseGeometry } from '@/shared/components/preview/useMeshGeometry';
import { computeActiveZones } from '@/features/bin-designer/types/featureColors';
import type { ColorZone } from '@/features/bin-designer/types/featureColors';
import {
  buildMultiColorGroups,
  hoveredMaterialIndices,
} from '@/features/bin-designer/utils/multiColorGroups';
import { buildZoneResolver } from '@/features/bin-designer/utils/zoneResolver';

const EDGE_COLOR = '#000000';

interface BinMeshProps {
  wireframe: boolean;
  /** Base color for the bin (user-selectable) */
  color: string;
  /**
   * Click handler invoked when a color tool is active. `screen` is in
   * viewport coordinates (clientX/clientY) so the parent can anchor a
   * popover at the click point. Only fired when `ui.colorTool` is set.
   */
  onZoneClick?: (zone: ColorZone, screen: { x: number; y: number }) => void;
}

export function BinMesh({ wireframe, color, onZoneClick }: BinMeshProps) {
  const { invalidate } = useThree();

  const {
    vertices,
    normals,
    indices,
    edgeVertices,
    faceGroups,
    coarseLOD,
    featureColors,
    baseStyle,
    stackingLip,
    labelEnabled,
    scoopEnabled,
    cells,
    hoveredColorZone,
    colorTool,
  } = useDesignerStore(
    useShallow((s) => ({
      vertices: s.generation.mesh?.vertices ?? null,
      normals: s.generation.mesh?.normals ?? null,
      indices: s.generation.mesh?.indices ?? null,
      edgeVertices: s.generation.mesh?.edgeVertices ?? null,
      faceGroups: s.generation.mesh?.faceGroups ?? null,
      coarseLOD: s.generation.mesh?.coarseLOD ?? null,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors is typed required but legacy persisted configs may omit it
      featureColors: s.params.featureColors ?? null,
      baseStyle: s.params.base.style,
      stackingLip: s.params.base.stackingLip,
      labelEnabled: s.params.label.enabled,
      scoopEnabled: s.params.scoop.enabled,
      cells: s.params.compartments.cells,
      hoveredColorZone: s.ui.hoveredColorZone,
      colorTool: s.ui.colorTool,
    }))
  );
  const setHoveredColorZone = useDesignerStore((s) => s.setHoveredColorZone);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors is typed required but legacy persisted configs may omit it; preserve runtime fallback
  const multiColorEnabled = featureColors?.enabled ?? false;

  const activeZones = useMemo(
    () =>
      computeActiveZones({
        base: { style: baseStyle, stackingLip },
        label: { enabled: labelEnabled },
        scoop: { enabled: scoopEnabled },
        compartments: { cells },
      }),
    [baseStyle, stackingLip, labelEnabled, scoopEnabled, cells]
  );

  // Build multi-color groups when feature is active
  const multiColorData = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors is null-coalesced upstream (legacy persisted configs); runtime guard kept as belt-and-suspenders.
    if (!multiColorEnabled || !faceGroups || !featureColors || !vertices || !indices) {
      return null;
    }
    return buildMultiColorGroups(faceGroups, vertices, indices, featureColors, activeZones);
  }, [multiColorEnabled, faceGroups, featureColors, vertices, indices, activeZones]);

  const { geometry, edgesGeometry, hasPrecomputedNormals } = useMeshGeometry({
    vertices,
    normals,
    indices,
    edgeVertices,
    faceGroups: multiColorData?.groups,
  });

  const coarseGeometry = useCoarseGeometry(coarseLOD);

  // Allocate one material per zone. Hover state is applied separately via
  // emissiveIntensity mutation, so a pointer move doesn't rebuild + dispose
  // every material on the GPU.
  const materials = useMemo(() => {
    if (!multiColorData) return null;
    return multiColorData.zoneColors.map(
      (c) =>
        new THREE.MeshStandardMaterial({
          color: c,
          roughness: 0.45,
          metalness: 0,
          wireframe,
          side: THREE.DoubleSide,
          emissive: new THREE.Color(c),
          emissiveIntensity: 0.08,
          flatShading: !hasPrecomputedNormals,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        })
    );
  }, [multiColorData, wireframe, hasPrecomputedNormals]);

  useEffect(() => {
    if (!materials) return;
    const hoveredIndices = hoveredMaterialIndices(hoveredColorZone);
    materials.forEach((mat, i) => {
      mat.emissiveIntensity = hoveredIndices.has(i) ? 0.35 : 0.08;
    });
    invalidate();
  }, [materials, hoveredColorZone, invalidate]);

  useEffect(() => {
    return () => {
      materials?.forEach((m) => m.dispose());
    };
  }, [materials]);

  useEffect(() => {
    if (geometry) invalidate();
  }, [geometry, invalidate]);

  useEffect(() => {
    invalidate();
  }, [wireframe, color, materials, invalidate]);

  // Invalidate when coarse geometry changes (LOD needs re-render)
  useEffect(() => {
    if (coarseGeometry) invalidate();
  }, [coarseGeometry, invalidate]);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors is null-coalesced upstream (legacy persisted configs); guard it
  const baseColor = multiColorEnabled && featureColors ? featureColors.body : color;

  // Single-color material props shared between fine mesh and coarse LOD
  const singleMatProps = useMemo(
    () => ({
      color: baseColor,
      roughness: 0.45,
      metalness: 0,
      wireframe,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(baseColor),
      emissiveIntensity: 0.08,
      flatShading: !hasPrecomputedNormals,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
    [baseColor, wireframe, hasPrecomputedNormals]
  );

  // Pointer handlers active only when a color tool is engaged AND multi-color
  // is on. Without the multi-color guard, disabling the toggle while a tool
  // is active would leave the mesh swallowing pointer events (the overlay UI
  // would be hidden but the canvas would still intercept clicks). Hover reuses
  // the same `hoveredColorZone` glow path the panel uses.
  const toolActive = colorTool !== null && multiColorEnabled;

  // Pre-compute the lip bbox once per mesh — `resolve()` runs on every
  // pointer-move when the tool is active, and re-scanning every LIP triangle
  // each frame is expensive on high-poly meshes.
  const zoneResolver = useMemo(() => {
    if (!toolActive || !faceGroups || !vertices || !indices) return null;
    return buildZoneResolver(faceGroups, vertices, indices);
  }, [toolActive, faceGroups, vertices, indices]);

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!zoneResolver) return;
      const triIndex = e.faceIndex;
      if (triIndex === undefined || triIndex === null) return;
      e.stopPropagation();
      const zone = zoneResolver.resolve(triIndex);
      if (zone !== hoveredColorZone) setHoveredColorZone(zone);
    },
    [zoneResolver, hoveredColorZone, setHoveredColorZone]
  );

  const handlePointerOut = useCallback(() => {
    if (!toolActive) return;
    setHoveredColorZone(null);
  }, [toolActive, setHoveredColorZone]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!zoneResolver || !onZoneClick) return;
      const triIndex = e.faceIndex;
      if (triIndex === undefined || triIndex === null) return;
      e.stopPropagation();
      const zone = zoneResolver.resolve(triIndex);
      onZoneClick(zone, { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
    },
    [zoneResolver, onZoneClick]
  );

  if (!geometry) return null;

  const meshProps = toolActive
    ? {
        onPointerMove: handlePointerMove,
        onPointerOut: handlePointerOut,
        onClick: handleClick,
      }
    : {};

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
          <lineBasicMaterial color={EDGE_COLOR} depthTest={true} />
        </lineSegments>
      )}
    </group>
  );
}
