/**
 * Lenient ("salvage") import validation for layouts loaded from local
 * storage.
 *
 * Where `validateImport` rejects the entire layout if any single bin is
 * invalid, `salvageImport` keeps the layout but moves problematic bins
 * into staging so the user can continue editing. Structural problems
 * (missing drawer, layer count out of bounds, invalid categories) still
 * fail outright — those can't be safely papered over.
 *
 * Returns the salvaged layout plus a list of human-readable messages
 * about which bins were moved and why.
 */

import type { Bin, Layout } from '@/core/types';
import {
  binId as toBinId,
  layerId as toLayerId,
  categoryId as toCategoryId,
  mm,
  gridUnits,
  heightUnits,
} from '@/core/types';
import { CONSTRAINTS, STAGING_ID } from '@/core/constants';
import { isValidDrawer, isValidLayer, isValidBin, isValidCategory } from './validationGuards';
import { canPlaceBin } from './validationPlacement';
import { validateImport, PLACEMENT_REASON_MESSAGE } from './validationImport';

export type SalvageSuccess = { valid: true; layout: Layout; salvaged: string[] };
export type SalvageFailure = { valid: false; salvaged?: undefined; layout?: undefined };
export type SalvageResult = SalvageSuccess | SalvageFailure;

export function salvageImport(data: unknown): SalvageResult {
  // Run strict validation first — if it passes, no salvaging needed
  const strict = validateImport(data);
  if (strict.valid) {
    return { valid: true, layout: strict.layout, salvaged: [] };
  }

  // Check if the structural shape is valid (drawer, layers, etc.)
  // We re-validate the core structure but handle bin errors leniently
  if (!data || typeof data !== 'object') {
    return { valid: false };
  }

  const raw = data as Record<string, unknown>;

  // Structural checks — these are fatal (can't salvage without them).
  // version/name must be non-empty strings; otherwise display formatting
  // (.slice, .trim) on the salvaged layout would later crash.
  if (
    typeof raw.version !== 'string' ||
    raw.version.trim().length === 0 ||
    typeof raw.name !== 'string' ||
    raw.name.trim().length === 0
  ) {
    return { valid: false };
  }
  if (!isValidDrawer(raw.drawer)) return { valid: false };
  if (!Array.isArray(raw.layers) || !Array.isArray(raw.bins) || !Array.isArray(raw.categories)) {
    return { valid: false };
  }

  const drawer = raw.drawer;
  if (drawer.width < CONSTRAINTS.GRID_MIN || drawer.width > CONSTRAINTS.GRID_MAX) {
    return { valid: false };
  }
  if (drawer.depth < CONSTRAINTS.GRID_MIN || drawer.depth > CONSTRAINTS.GRID_MAX) {
    return { valid: false };
  }

  const layers = raw.layers as unknown[];
  if (layers.length < CONSTRAINTS.LAYERS_MIN || layers.length > CONSTRAINTS.LAYERS_MAX) {
    return { valid: false };
  }

  const validLayers = layers.filter(isValidLayer);
  if (validLayers.length !== layers.length) return { valid: false };

  const layerIds = new Set(validLayers.map((l) => l.id));
  layerIds.add(STAGING_ID);

  const totalHeight = validLayers.reduce((sum, layer) => sum + layer.height, 0);
  if (totalHeight > drawer.height) return { valid: false };

  // Validate categories (fatal if structurally invalid)
  const categories = raw.categories as unknown[];
  for (const cat of categories) {
    if (!isValidCategory(cat)) return { valid: false };
  }

  // Now handle bins leniently — invalid bins get moved to staging
  const bins = raw.bins as unknown[];
  const salvaged: string[] = [];
  const resultBins: Bin[] = [];
  const validatedGridBins: Bin[] = []; // Pool for collision checking

  bins.forEach((bin, i) => {
    if (!isValidBin(bin)) {
      // Structurally invalid bins can't be salvaged (missing required fields)
      salvaged.push(`Bin ${i} is structurally invalid and was removed`);
      return;
    }

    const typedBin: Bin = {
      id: toBinId(bin.id),
      layerId: toLayerId(bin.layerId),
      x: gridUnits(bin.x),
      y: gridUnits(bin.y),
      width: gridUnits(bin.width),
      depth: gridUnits(bin.depth),
      height: heightUnits(bin.height),
      category: toCategoryId(bin.category || ''),
      label: bin.label || '',
      notes: bin.notes || '',
      customProperties: bin.customProperties,
    };

    // Staging bins pass through
    if (bin.layerId === STAGING_ID) {
      resultBins.push(typedBin);
      return;
    }

    // Check if layer exists
    if (!layerIds.has(bin.layerId)) {
      salvaged.push(`Bin ${i} references invalid layer and was moved to staging`);
      resultBins.push({ ...typedBin, layerId: STAGING_ID });
      return;
    }

    // Check placement (bounds, height, collisions, blocked zones)
    const partialLayout: Layout = {
      version: '1.0',
      name: 'salvage-validation',
      drawer: {
        width: gridUnits(drawer.width),
        depth: gridUnits(drawer.depth),
        height: heightUnits(drawer.height),
      },
      layers: validLayers.map((l) => ({
        ...l,
        height: heightUnits((l as { height: number }).height),
      })) as Layout['layers'],
      bins: validatedGridBins,
      categories: [] as Layout['categories'],
      printBedSize: mm(256),
      gridUnitMm: mm(42),
      heightUnitMm: mm(7),
    };

    const placementResult = canPlaceBin(
      {
        x: gridUnits(bin.x),
        y: gridUnits(bin.y),
        width: gridUnits(bin.width),
        depth: gridUnits(bin.depth),
        height: heightUnits(bin.height),
      },
      toLayerId(bin.layerId),
      partialLayout
    );

    if (!placementResult.valid) {
      const message = PLACEMENT_REASON_MESSAGE[placementResult.reason] || 'has invalid placement';
      salvaged.push(`Bin ${i} ${message} and was moved to staging`);
      resultBins.push({ ...typedBin, layerId: STAGING_ID });
      return;
    }

    // Valid bin — add to grid and collision pool
    validatedGridBins.push(typedBin);
    resultBins.push(typedBin);
  });

  // Build salvaged layout
  const salvageLayout: Layout = {
    ...(data as Layout),
    bins: resultBins,
  };

  return { valid: true, layout: salvageLayout, salvaged };
}
