/**
 * Multi-color rendering and zone picking for one bin mesh: the material per
 * color zone, the hover glow, and the pointer handlers the eyedropper and swap
 * tools use. Shared by the whole bin (`BinMesh`) and each split piece
 * (`SplitBinMeshes`), so a split bin colors and picks the same way.
 */

import { useCallback, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useActiveColorZones } from '@/features/bin-designer/hooks/useActiveColorZones';
import { planCompartmentColors } from '@/features/bin-designer/utils/compartmentColorUnits';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';
import type { ColorZone } from '@/features/bin-designer/types/featureColors';
import type { FaceGroupData } from '@/shared/types/generation';
import {
  buildHitTestZones,
  buildMultiColorGroups,
  hoveredMaterialIndices,
} from '@/features/bin-designer/utils/multiColorGroups';
import type { ColorFrame } from '@/features/bin-designer/utils/colorFrame';
import { buildZoneResolver } from '@/features/bin-designer/utils/zoneResolver';
import { enumerateCutoutColorUnits, anyCutoutColored } from '@/shared/generation/cutoutColorUnits';

/** Face opacity when xray mode is enabled. Matches brepjs-studio. */
const XRAY_OPACITY = 0.3;

export type ZoneClickHandler = (zone: ColorZone, screen: { x: number; y: number }) => void;

export interface ZoneColoredMeshInput {
  readonly vertices: Float32Array | null;
  readonly normals: Float32Array | null;
  readonly indices: Uint32Array | null;
  readonly edgeVertices: Float32Array | null;
  readonly faceGroups: readonly FaceGroupData[] | null;
  /** Whole-assembly measurements for a split piece; null measures this mesh. */
  readonly frame?: ColorFrame | null;
  readonly wireframe: boolean;
  readonly xray: boolean;
  /** Single-color fallback when multi-color is off. */
  readonly color: string;
  readonly onZoneClick?: ZoneClickHandler;
}

export interface ZoneColoredMesh {
  readonly geometry: THREE.BufferGeometry | null;
  readonly edgesGeometry: THREE.BufferGeometry | null;
  readonly hasPrecomputedNormals: boolean;
  /** One material per zone; null when the mesh renders in one color. */
  readonly materials: THREE.MeshStandardMaterial[] | null;
  readonly singleMatProps: THREE.MeshStandardMaterialParameters;
  /** Pointer handlers for the color tools; empty when no tool is active. */
  readonly meshProps: {
    readonly onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
    readonly onPointerOut?: () => void;
    readonly onClick?: (e: ThreeEvent<MouseEvent>) => void;
  };
}

export function useZoneColoredMesh(input: ZoneColoredMeshInput): ZoneColoredMesh {
  const { vertices, normals, indices, edgeVertices, faceGroups, wireframe, xray, color } = input;
  const frame = input.frame ?? null;
  const { onZoneClick } = input;
  const { invalidate } = useThree();

  const { featureColors, cutouts, hoveredColorZone, colorTool } = useDesignerStore(
    useShallow((s) => ({
      featureColors: s.params.featureColors,
      cutouts: s.params.cutouts,
      hoveredColorZone: s.ui.hoveredColorZone,
      colorTool: s.ui.colorTool,
    }))
  );
  const setHoveredColorZone = useDesignerStore((s) => s.setHoveredColorZone);
  const multiColorEnabled = featureColors.enabled;
  const cutoutUnits = useMemo(() => enumerateCutoutColorUnits(cutouts), [cutouts]);
  // Compartment colours are classified by position, so the plan needs the whole
  // param tree (interior size, overhang offset, floor plane). It returns null
  // the moment no compartment is coloured, which is the common case.
  const params = useDesignerStore((s) => s.params);
  const compartmentPlan = useMemo(() => planCompartmentColors(params), [params]);
  // A colored cutout or compartment makes the design multi-color even if the
  // user never opened the Multi-Color panel.
  const multiColorActive = multiColorEnabled || anyCutoutColored(cutouts) || !!compartmentPlan;

  // Text-bearing params included: with Text the only colour that differs from
  // Body, leaving them out reads the design as single-colour and paints the
  // glyphs body-coloured while the 3MF prints them in the text filament.
  const activeZones = useActiveColorZones();

  const multiColorData = useMemo(() => {
    if (!multiColorActive || !faceGroups || !vertices || !indices) return null;
    return buildMultiColorGroups(
      faceGroups,
      vertices,
      indices,
      featureColors,
      activeZones,
      cutoutUnits,
      compartmentPlan,
      frame
    );
  }, [
    multiColorActive,
    faceGroups,
    featureColors,
    vertices,
    indices,
    activeZones,
    cutoutUnits,
    compartmentPlan,
    frame,
  ]);

  // A split lip grid re-tessellates the lip into a flat (non-indexed) buffer;
  // render that instead of the worker's indexed mesh so the seam-aligned color
  // boundaries actually show. Passing the flat normals keeps the crease path
  // active (useMeshGeometry recomputes + creases, so the rim stays sharp).
  const meshOverride = multiColorData?.meshOverride ?? null;
  const { geometry, edgesGeometry, hasPrecomputedNormals } = useMeshGeometry({
    vertices: meshOverride?.vertices ?? vertices,
    normals: meshOverride?.normals ?? normals,
    indices: meshOverride ? null : indices,
    edgeVertices,
    faceGroups: multiColorData?.groups,
  });

  // Hover state is applied separately via emissiveIntensity mutation, so a
  // pointer move doesn't rebuild + dispose every material on the GPU.
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
          transparent: xray,
          opacity: xray ? XRAY_OPACITY : 1,
          depthWrite: !xray,
        })
    );
  }, [multiColorData, wireframe, hasPrecomputedNormals, xray]);

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

  const baseColor = multiColorEnabled ? featureColors.body : color;
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
      transparent: xray,
      opacity: xray ? XRAY_OPACITY : 1,
      depthWrite: !xray,
    }),
    [baseColor, wireframe, hasPrecomputedNormals, xray]
  );

  // Without the multi-color guard, disabling the toggle while a tool is active
  // would leave the mesh swallowing pointer events.
  const toolActive = colorTool !== null && multiColorEnabled;

  // Hit-test reads per-rendered-triangle zones so a click resolves to exactly
  // the cell shown. When multi-color is on but every zone still shares one
  // color, `buildMultiColorGroups` returns null; fall back to an in-place
  // classification over the un-split mesh so the eyedropper/swap can still
  // pick a zone to start editing.
  const zoneResolver = useMemo(() => {
    if (!toolActive) return null;
    if (multiColorData) return buildZoneResolver(multiColorData.triZones);
    if (!faceGroups || !vertices || !indices) return null;
    return buildZoneResolver(
      buildHitTestZones(faceGroups, vertices, indices, featureColors, frame)
    );
  }, [toolActive, multiColorData, faceGroups, featureColors, vertices, indices, frame]);

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

  const meshProps = useMemo(
    () =>
      toolActive
        ? { onPointerMove: handlePointerMove, onPointerOut: handlePointerOut, onClick: handleClick }
        : {},
    [toolActive, handlePointerMove, handlePointerOut, handleClick]
  );

  return { geometry, edgesGeometry, hasPrecomputedNormals, materials, singleMatProps, meshProps };
}
