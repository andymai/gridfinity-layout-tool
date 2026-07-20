/**
 * Stack-print preview: renders each baseplate tower (bottom plate upright, the
 * rest flipped) the way it prints, separated by an interactive slider.
 */

import { useEffect, useMemo } from 'react';
import { Text } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import type { StackPrintParams } from '@/core/types';
import { STACK_PRINT_DEFAULT_COPIES } from '@/core/types';
import { MESH_MATERIAL_PROPS, EDGE_MATERIAL_PROPS } from './materialProps';
import { useMeshGeometry } from './useMeshGeometry';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { buildFullParams } from '../../utils/buildFullParams';
import { pieceToBaseplateParams, bodyParamsForDetach } from '../../utils/splitPlanner';
import {
  stackGroupsFromTiling,
  planPhysicalStacks,
  stackHeightCap,
  bodyCenterYMm,
  isUnstackedSplit,
  type StackMeshArrays,
} from '../../utils/stackPrint';
import { buildStackPreviewMeshes, type StackPreviewTower } from '../../utils/stackPreview';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';

const EMPTY_GEO = { vertices: null, normals: null, indices: null, edgeVertices: null } as const;
const EMPTY_F32 = new Float32Array(0);

interface StackedBaseplateMeshesProps {
  readonly stack: StackPrintParams;
  readonly color: string;
  /** Extra explode distance (mm) from the preview slider; 0 = true export gap. */
  readonly separationMm: number;
  /** Reports layout extents so the parent can frame the camera. */
  readonly onBounds?: (bounds: { widthMm: number; depthMm: number; heightMm: number }) => void;
}

function toMeshArrays(mesh: {
  vertices: Float32Array | null;
  normals: Float32Array | null;
  indices: Uint32Array | null;
  edgeVertices: Float32Array | null;
}): StackMeshArrays | null {
  if (!mesh.vertices || !mesh.indices) return null;
  return {
    vertices: mesh.vertices,
    // null normals → empty array; stack transform is a no-op on zero elements,
    // and useMeshGeometry falls back to flat shading when normals.length === 0.
    normals: mesh.normals ?? EMPTY_F32,
    indices: mesh.indices,
    edgeVertices: mesh.edgeVertices ?? EMPTY_F32,
  };
}

const LABEL_Z_OFFSET = 8;
const LABEL_FONT_SIZE = 6;

export function StackedBaseplateMeshes({
  stack,
  color,
  separationMm,
  onBounds,
}: StackedBaseplateMeshesProps) {
  const colors = useThreeColors();
  const {
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    fractionalEdgeX,
    fractionalEdgeY,
    baseplateParams,
  } = useLayoutStore(
    useShallow((s) => ({
      drawerWidth: s.layout.drawer.width,
      drawerDepth: s.layout.drawer.depth,
      gridUnitMm: s.layout.gridUnitMm,
      fractionalEdgeX: s.layout.drawer.fractionalEdgeX ?? 'end',
      fractionalEdgeY: s.layout.drawer.fractionalEdgeY ?? 'end',
      baseplateParams: s.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
    }))
  );
  const nozzleSizeMm = useSettingsStore((s) => s.settings.printSettings.nozzleSizeMm);
  const maxPrintHeightMm = useSettingsStore((s) => s.settings.printSettings.maxPrintHeightMm);

  const tiling = useBaseplatePageStore((s) => s.tiling);
  const singleMesh = useBaseplatePageStore((s) => s.generation.mesh);
  const pieceMeshes = useBaseplatePageStore((s) => s.pieceMeshes);

  const preview = useMemo(() => {
    const fullParams = buildFullParams(
      baseplateParams,
      drawerWidth,
      drawerDepth,
      gridUnitMm,
      fractionalEdgeX,
      fractionalEdgeY,
      nozzleSizeMm
    );
    const groups = stackGroupsFromTiling(
      tiling,
      fullParams,
      stack.copies ?? STACK_PRINT_DEFAULT_COPIES
    );
    const cap = stackHeightCap(maxPrintHeightMm, GRIDFINITY_SPEC.SOCKET_HEIGHT, stack.gapMm);
    const plan = planPhysicalStacks(groups, cap);
    const isSplit = tiling?.isSplit ?? false;

    // The unsplit mesh is generated from the detach-adjusted body params
    // (padding-free on detached sides), so the body centre must come from the
    // same params or flipped copies re-seat off-axis by the removed padding.
    const singleBody = bodyParamsForDetach(fullParams);
    const singleBodyY = bodyCenterYMm(singleBody.paddingFront, singleBody.paddingBack);

    // Index pieces/meshes by label once: the loop and the spatial-positioning
    // pass below both look up by label, so a per-tower find() would be O(n²).
    const pieceByLabel = new Map(tiling?.pieces.map((p) => [p.label, p]) ?? []);
    const meshByLabel = new Map(pieceMeshes.map((p) => [p.label, p.mesh]));

    const towers: StackPreviewTower[] = [];
    const filteredPlan: typeof plan = [];
    for (const physical of plan) {
      let source: Parameters<typeof toMeshArrays>[0] | null = singleMesh;
      let bodyY = singleBodyY;
      if (isSplit) {
        source = meshByLabel.get(physical.label) ?? null;
        const piece = pieceByLabel.get(physical.label);
        if (piece) {
          // Derive the body centre from the SAME params the mesh was generated
          // with: pieceToBaseplateParams swaps front/back padding for
          // preferIdenticalPieces 180° pieces, so raw piece padding would give
          // the wrong sign (the export path already uses these rotated params).
          const genParams = pieceToBaseplateParams(piece, fullParams);
          bodyY = bodyCenterYMm(genParams.paddingFront, genParams.paddingBack);
        }
      }
      const arrays = source ? toMeshArrays(source) : null;
      if (arrays) {
        towers.push({ mesh: arrays, copies: physical.copies, bodyCenterYMm: bodyY });
        filteredPlan.push(physical);
      }
    }
    if (towers.length === 0) return null;

    // "No stacks": every tower is a single plate mapping 1:1 onto the split
    // pieces (no fingerprint dedup, no height-cap split — see isUnstackedSplit).
    // Then the towers ARE the split pieces, so position each at its tiling slot
    // and the preview reads in assembled order instead of a square grid.
    const noStacks = isSplit && isUnstackedSplit(filteredPlan, tiling?.pieces.length ?? 0);
    const positionedTowers = noStacks
      ? towers.map((tower, i) => {
          const piece = pieceByLabel.get(filteredPlan[i].label);
          return piece ? { ...tower, col: piece.col, row: piece.row } : tower;
        })
      : towers;

    return {
      meshes: buildStackPreviewMeshes(positionedTowers, stack, separationMm, gridUnitMm),
      plan: filteredPlan,
    };
  }, [
    baseplateParams,
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    fractionalEdgeX,
    fractionalEdgeY,
    nozzleSizeMm,
    maxPrintHeightMm,
    tiling,
    singleMesh,
    pieceMeshes,
    stack,
    separationMm,
  ]);

  const meshResult = preview?.meshes ?? null;
  const plan = preview?.plan ?? [];
  const widthMm = meshResult?.widthMm ?? 0;
  const depthMm = meshResult?.depthMm ?? 0;
  const heightMm = meshResult?.heightMm ?? 0;
  useEffect(() => {
    if (meshResult && onBounds) onBounds({ widthMm, depthMm, heightMm });
  }, [meshResult, onBounds, widthMm, depthMm, heightMm]);

  const plateGeo = useMeshGeometry(meshResult ? meshResult.plates : EMPTY_GEO);

  if (!meshResult || !plateGeo.geometry) return null;

  return (
    <>
      <mesh geometry={plateGeo.geometry}>
        <meshStandardMaterial
          {...MESH_MATERIAL_PROPS}
          color={color}
          emissive={color}
          flatShading={!plateGeo.hasPrecomputedNormals}
        />
      </mesh>
      {plateGeo.edgesGeometry && (
        <lineSegments geometry={plateGeo.edgesGeometry} renderOrder={1}>
          <lineBasicMaterial {...EDGE_MATERIAL_PROPS} />
        </lineSegments>
      )}
      {meshResult.towerLayouts.map((layout, idx) => {
        const entry = plan[idx];
        if (!entry) return null;
        const label = `×${entry.copies}`;
        return (
          <Text
            key={idx}
            position={[layout.centerX, layout.centerY, layout.heightMm + LABEL_Z_OFFSET]}
            fontSize={LABEL_FONT_SIZE}
            color={colors.labelColor}
            fillOpacity={0.7}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.3}
            outlineColor={colors.gradientBottom}
            renderOrder={2}
            raycast={() => null}
          >
            {label}
          </Text>
        );
      })}
    </>
  );
}
