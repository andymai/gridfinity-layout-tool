/**
 * Stack-print preview: renders the baseplate as flipped vertical towers (one per
 * physical print job) matching the export, separated by an interactive slider.
 * Sacrificial interface sheets render in an accent material.
 */

import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import type { StackPrintParams } from '@/core/types';
import { MESH_MATERIAL_PROPS, EDGE_MATERIAL_PROPS } from './materialProps';
import { useMeshGeometry } from './useMeshGeometry';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { buildFullParams } from '../../utils/buildFullParams';
import {
  stackGroupsFromTiling,
  planPhysicalStacks,
  type StackMeshArrays,
} from '../../utils/stackPrint';
import { buildStackPreviewMeshes, type StackPreviewTower } from '../../utils/stackPreview';

const FALLBACK_ACCENT = '#f59e0b';

const EMPTY_GEO = { vertices: null, normals: null, indices: null, edgeVertices: null } as const;

function accentHex(): string {
  if (typeof document === 'undefined') return FALLBACK_ACCENT;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
  return raw || FALLBACK_ACCENT;
}

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
  if (!mesh.vertices || !mesh.normals || !mesh.indices) return null;
  return {
    vertices: mesh.vertices,
    normals: mesh.normals,
    indices: mesh.indices,
    edgeVertices: mesh.edgeVertices ?? new Float32Array(0),
  };
}

export function StackedBaseplateMeshes({
  stack,
  color,
  separationMm,
  onBounds,
}: StackedBaseplateMeshesProps) {
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
    const groups = stackGroupsFromTiling(tiling, fullParams);
    const plan = planPhysicalStacks(groups, stack.sets);
    const isSplit = tiling?.isSplit ?? false;

    const towers: StackPreviewTower[] = [];
    for (const physical of plan) {
      const source = isSplit
        ? pieceMeshes.find((p) => p.label === physical.label)?.mesh
        : singleMesh;
      const arrays = source ? toMeshArrays(source) : null;
      if (arrays) towers.push({ mesh: arrays, copies: physical.copies });
    }
    if (towers.length === 0) return null;
    return buildStackPreviewMeshes(towers, stack, separationMm);
  }, [
    baseplateParams,
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    fractionalEdgeX,
    fractionalEdgeY,
    nozzleSizeMm,
    tiling,
    singleMesh,
    pieceMeshes,
    stack,
    separationMm,
  ]);

  const widthMm = preview?.widthMm ?? 0;
  const depthMm = preview?.depthMm ?? 0;
  const heightMm = preview?.heightMm ?? 0;
  useEffect(() => {
    if (preview && onBounds) onBounds({ widthMm, depthMm, heightMm });
  }, [preview, onBounds, widthMm, depthMm, heightMm]);

  const plateGeo = useMeshGeometry(preview ? preview.plates : EMPTY_GEO);
  const sheetGeo = useMeshGeometry(preview?.sheets ?? EMPTY_GEO);

  if (!preview || !plateGeo.geometry) return null;

  const sheetColor = accentHex();

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

      {sheetGeo.geometry && (
        <mesh geometry={sheetGeo.geometry} renderOrder={2}>
          <meshStandardMaterial
            color={sheetColor}
            emissive={sheetColor}
            emissiveIntensity={0.15}
            roughness={0.6}
            metalness={0}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      )}
    </>
  );
}
