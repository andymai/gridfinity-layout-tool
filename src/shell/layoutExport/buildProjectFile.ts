/**
 * Packs a layout's parts into ONE slicer project file with every part already
 * placed on a build plate.
 *
 * Takes `ThreeMFObject`s rather than model files so a part keeps the
 * `colorConfig` its own builder derived (`buildMultiObject3MFObjects`,
 * `buildLabelPlateColorConfig`). Re-deriving colour here would duplicate the
 * zone/cutout logic; dropping it would silently flatten multi-colour designs.
 *
 * Bambu Studio and OrcaSlicer read the plate assignment from
 * `model_settings.config` while drawing each part at its world transform in
 * `3dmodel.model`. Both come from the same `packOntoPlates` result here, so
 * they cannot disagree.
 */

import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { export3MFMultiObject } from '@/shared/generation/export';
import type {
  ThreeMFObject,
  ThreeMFPrintSettings,
  ThreeMFColorConfig,
} from '@/shared/generation/export';
import {
  packOntoPlates,
  plateOrigin,
  DEFAULT_PART_SPACING_MM,
  DEFAULT_PLATE_MARGIN_MM,
} from './platePacking';
import type { PlatePackingItem } from './platePacking';

export interface BuildProjectFileOptions {
  readonly name: string;
  readonly bedWidthMm: number;
  readonly bedDepthMm: number;
  readonly printSettings: ThreeMFPrintSettings;
}

export interface ProjectFileResult {
  readonly data: ArrayBuffer;
  readonly plateCount: number;
  readonly partCount: number;
  /** Names of parts that exceed the usable bed area. */
  readonly oversizeNames: readonly string[];
}

export interface ProjectPartCollector {
  /** Add a part from raw binary STL. Unparseable payloads are skipped. */
  readonly addStl: (name: string, stl: ArrayBuffer, colorConfig?: ThreeMFColorConfig) => void;
  /** Add parts that already carry their own colour mapping. */
  readonly addObjects: (objects: readonly ThreeMFObject[]) => void;
  readonly parts: readonly ThreeMFObject[];
}

/**
 * Gathers parts across the export's phases, which produce geometry in three
 * shapes: raw STL from the worker, coloured `ThreeMFObject`s from the bin
 * builders, and STL plus a separately-derived colour config for label sheets.
 */
export function createProjectPartCollector(): ProjectPartCollector {
  const parts: ThreeMFObject[] = [];
  return {
    addStl(name, stl, colorConfig) {
      const parsed = parseSTLBinary(stl);
      if (!isOk(parsed)) return;
      parts.push({
        vertices: parsed.value.vertices,
        normals: parsed.value.normals,
        name,
        colorConfig,
      });
    },
    addObjects(objects) {
      parts.push(...objects);
    },
    parts,
  };
}

/** Footprint bounding box, which is what the packer arranges. */
export function footprintOf(vertices: Float32Array): PlatePackingItem {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const y = vertices[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { widthMm: 0, depthMm: 0 };
  }
  return { widthMm: maxX - minX, depthMm: maxY - minY };
}

/**
 * Build the project file. Returns null when no part carries geometry, so the
 * caller ships the individual parts rather than replacing them with an empty
 * file.
 */
export async function buildLayoutProjectFile(
  parts: readonly ThreeMFObject[],
  options: BuildProjectFileOptions
): Promise<ProjectFileResult | null> {
  const usable = parts.filter((p) => p.vertices.length > 0);
  if (usable.length === 0) return null;

  const packing = packOntoPlates(
    usable.map((p) => footprintOf(p.vertices)),
    {
      bedWidthMm: options.bedWidthMm,
      bedDepthMm: options.bedDepthMm,
      spacingMm: DEFAULT_PART_SPACING_MM,
      marginMm: DEFAULT_PLATE_MARGIN_MM,
    }
  );

  const placed: ThreeMFObject[] = usable.map((part, i) => {
    const placement = packing.placements[i];
    const origin = plateOrigin(
      placement.plate,
      packing.plateCount,
      options.bedWidthMm,
      options.bedDepthMm
    );
    return {
      ...part,
      placement: {
        plate: placement.plate,
        x: origin.x + placement.x,
        y: origin.y + placement.y,
      },
    };
  });

  const blob = export3MFMultiObject(placed, {
    name: options.name,
    printSettings: options.printSettings,
  });

  return {
    data: await blob.arrayBuffer(),
    plateCount: packing.plateCount,
    partCount: placed.length,
    oversizeNames: packing.oversizeIndices.map((i) => usable[i].name),
  };
}
