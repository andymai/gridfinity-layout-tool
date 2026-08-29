import type { ThreeMFColorConfig } from './threemfTypes';
import { escapeXml } from './threemfXml';

export function activeColorConfig(
  c: ThreeMFColorConfig | undefined
): ThreeMFColorConfig | undefined {
  return c && c.materials.length > 0 ? c : undefined;
}

export interface UnifiedColorConfigs {
  /** `filament_colour` list, or undefined when no object carries colors. */
  readonly palette: readonly string[] | undefined;
  /** Per input config, remapped into the merged palette's slot space. */
  readonly configs: readonly (ThreeMFColorConfig | undefined)[];
}

/**
 * Resolve one shared palette from the objects' colorConfigs. Per-triangle
 * `paint_color` codes are object-local references into the object's own slot
 * list, so objects with different palettes cannot share the file's single
 * `filament_colour` list as-is: the same code would resolve to different
 * filaments per object. When palettes differ (two bins with different zone
 * colors in one layout project file), the distinct colors are merged in
 * first-seen order — shared colors collapse onto one filament — and each
 * config's triangle slots are rewritten to reference the merged palette.
 *
 * Returns an undefined palette when no object carries colors, so single-color
 * exports skip the sidecar entirely. Throws only when the merged union
 * exceeds the slicer's filament cap, which no remapping can represent.
 */
export function unifyColorConfigs(
  configs: readonly (ThreeMFColorConfig | undefined)[]
): UnifiedColorConfigs {
  const actives = configs.map(activeColorConfig);
  const present = actives.filter((c): c is ThreeMFColorConfig => c !== undefined);
  if (present.length === 0) return { palette: undefined, configs: actives };

  // Identical arrays need no remap; pass them through untouched so a palette
  // that deliberately repeats a color keeps its slot layout.
  const first = present[0].materials;
  if (present.every((c) => materialsMatch(first, c.materials))) {
    return { palette: first.map((m) => m.color.toLowerCase()), configs: actives };
  }

  const slotByColor = new Map<string, number>();
  const mergedSlot = (color: string): number => {
    const key = color.toLowerCase();
    const existing = slotByColor.get(key);
    if (existing !== undefined) return existing;
    slotByColor.set(key, slotByColor.size);
    return slotByColor.size - 1;
  };
  const slotMaps = actives.map((c) => c?.materials.map((m) => mergedSlot(m.color)));

  if (slotByColor.size > MAX_COLOR_SLOTS) {
    throw new Error(
      `3MF multi-object: ${slotByColor.size} distinct colors across objects exceeds slicer filament cap of ${MAX_COLOR_SLOTS}`
    );
  }

  const palette = [...slotByColor.keys()];
  const mergedMaterials = palette.map((color) => ({ color }));
  const remapped = actives.map((config, i) => {
    const slotMap = slotMaps[i];
    if (!config || !slotMap) return undefined;
    return {
      materials: mergedMaterials,
      triangleMaterialIndices: config.triangleMaterialIndices.map((slot) => slotMap[slot]),
    };
  });
  return { palette, configs: remapped };
}

function materialsMatch(
  a: ThreeMFColorConfig['materials'],
  b: ThreeMFColorConfig['materials']
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].color.toLowerCase() !== b[i].color.toLowerCase()) return false;
  }
  return true;
}

/**
 * Minimal Bambu/Orca `project_settings.config` JSON. The slicer parses this
 * via `ConfigBase::load_from_json` (Config.cpp:807); any recognized key
 * flips `DynamicPrintConfig.empty()` to false, which is what gates the
 * "geometry only" warning. `filament_colour` is the right key for our use
 * case — `coStrings` per PrintConfig.cpp, displayed as the AMS slot colors.
 *
 * Headers (`version`, `name="project_settings"`, `from`) are read into a
 * key_values map but are advisory: the loader doesn't gate on them.
 */
export function buildProjectSettingsConfig(palette: readonly string[]): string {
  return JSON.stringify(
    {
      // Headers are advisory — Bambu's load_from_json stores them in a
      // key_values map but doesn't gate on them. Aligned with the Application
      // metadata version (BAMBU_COMPAT_APPLICATION) for human consistency.
      version: '2.0.0.0',
      name: 'project_settings',
      from: 'Gridfinity Layout Tool',

      filament_colour: palette,

      // Multi-material printing on non-Bambu Marlin-based printers
      // (OrcaSlicer's `is_BBL_printer() == false` branch in Print.cpp:1679)
      // imposes two coupled requirements that the user hits as validation
      // errors during slice:
      //
      //   1. Print.cpp:1434 — the wipe tower (needed to clean the nozzle
      //      between filament swaps) "is currently only supported with
      //      relative extruder addressing (use_relative_e_distances=1)".
      //   2. Print.cpp:1683-1689 — relative extruder addressing then
      //      requires a `G92 E0` reset in `before_layer_change_gcode` or
      //      `layer_change_gcode`, because "relative extruder addressing
      //      requires resetting the extruder position at each layer to
      //      prevent loss of floating point accuracy."
      //
      // Set both so multi-color exports slice without surfacing this
      // validation error to the user. Bambu users skip the check entirely
      // (Bambu printers have native multi-material handling) so the
      // settings are harmless there. Users with a custom layer_change_gcode
      // will see ours override theirs on import — a small price for the
      // alternative of every multi-color export failing to slice on first try.
      use_relative_e_distances: '1',
      layer_change_gcode: 'G92 E0 ; Reset extruder for accurate multi-material\n',

      // Deliberately no acceleration keys. Do not re-add
      // `default_acceleration` / `travel_acceleration`: pinning them to '0'
      // (to silence Orca's "travel acceleration exceeds
      // machine_max_acceleration_extruding" warning) trips Orca's
      // `have_default_acceleration = default_acceleration > 0` gate, which
      // hides every per-feature acceleration override in the loaded profile.
      // On import (Bambu included) that drops the user's tuned accelerations
      // to machine defaults and inflates multi-color print time several-fold
      //. The warning it silenced is non-blocking.
    },
    null,
    2
  );
}

/**
 * Most frequent material slot across a triangle→slot list. For a uniform
 * object (lid, divider) that's its single slot; for the multi-zone bin it's
 * the body, which is the right base extruder since per-triangle `paint_color`
 * overrides the rest. Ties resolve to the lower slot index, so a bin with no
 * dominant zone falls back to body (slot 0) rather than an arbitrary feature.
 */
function dominantSlot(triangleMaterialIndices: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const slot of triangleMaterialIndices) {
    counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = -1;
  for (const [slot, n] of counts) {
    if (n > bestCount || (n === bestCount && slot < best)) {
      bestCount = n;
      best = slot;
    }
  }
  return best;
}

/**
 * Per-object settings sidecar (`Metadata/model_settings.config`) assigning
 * each colored object its base `extruder` = dominant slot + 1 (slicers are
 * 1-based, matching the `paint_color` slot→filament mapping). BambuStudio and
 * OrcaSlicer color a whole object by this extruder; without it every object
 * defaults to extruder 1 (body), so a uniform secondary object like the lid
 * renders body-colored even though its triangles carry the correct
 * `paint_color` (discussion). Purely additive — slicers that ignore the
 * sidecar fall back to today's paint_color-only behavior, so it can't regress
 * the already-working multi-zone bin.
 *
 * The same file also declares BUILD PLATES. A `<plate>` carries its 1-based
 * `plater_id` and one `<model_instance>` per part assigned to it, referencing
 * the object by the same id the model XML used. That reference is the whole
 * mechanism: the part's world transform decides where it is drawn, this decides
 * which plate owns it, and a slicer renders a part floating off its plate if
 * the two disagree. Note the key is `plater_name`, not `plate_name` (an
 * upstream spelling that stuck).
 *
 * Returns undefined when no object carries colors AND no plates are declared
 * (single-color single-plate assemblies need no sidecar at all).
 */
export function buildModelSettingsConfig(
  meshes: readonly {
    name: string;
    colorConfig?: ThreeMFColorConfig;
    placement?: { plate: number };
  }[]
): string | undefined {
  const entries: string[] = [];
  meshes.forEach((m, i) => {
    const colorConfig = activeColorConfig(m.colorConfig);
    if (!colorConfig) return;
    const extruder = dominantSlot(colorConfig.triangleMaterialIndices) + 1;
    const objectId = i + 1;
    entries.push(
      `  <object id="${objectId}">\n` +
        `    <metadata key="name" value="${escapeXml(m.name)}"/>\n` +
        `    <metadata key="extruder" value="${extruder}"/>\n` +
        `  </object>\n`
    );
  });

  const plates = buildPlateEntries(meshes);
  if (entries.length === 0 && plates.length === 0) return undefined;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n${entries.join('')}${plates.join('')}</config>\n`;
}

function buildPlateEntries(
  meshes: readonly { placement?: { plate: number } }[]
): readonly string[] {
  const byPlate = new Map<number, number[]>();
  meshes.forEach((m, i) => {
    if (!m.placement) return;
    const ids = byPlate.get(m.placement.plate);
    if (ids) ids.push(i + 1);
    else byPlate.set(m.placement.plate, [i + 1]);
  });
  if (byPlate.size === 0) return [];

  // Emit every plate from 0 to the highest occupied index, in order. A gap
  // would renumber the plates that follow it, silently moving parts to a
  // different plate than the one they were packed onto.
  const maxPlate = Math.max(...byPlate.keys());
  const out: string[] = [];
  for (let plate = 0; plate <= maxPlate; plate++) {
    const ids = byPlate.get(plate) ?? [];
    const instances = ids
      .map(
        (id) =>
          `    <model_instance>\n` +
          `      <metadata key="object_id" value="${id}"/>\n` +
          `      <metadata key="instance_id" value="0"/>\n` +
          `    </model_instance>\n`
      )
      .join('');
    out.push(
      `  <plate>\n` +
        `    <metadata key="plater_id" value="${plate + 1}"/>\n` +
        `    <metadata key="plater_name" value=""/>\n` +
        instances +
        `  </plate>\n`
    );
  }
  return out;
}

/**
 * Per-filament paint_color encoding table, lifted verbatim from OrcaSlicer's
 * `CONST_FILAMENTS` (libslic3r/Model.cpp). Index N is the bit-tree code for
 * filament N (1-based) in the slicer's AMS / extruder list:
 *
 *   - Index 0 → `""` (no filament; means "no override / default extruder").
 *     Not used by our exporter — every triangle gets an explicit code so
 *     zone-to-filament mapping doesn't depend on the object's default
 *     extruder setting.
 *   - Index 1 → `"4"`, filament 1.
 *   - Index 2 → `"8"`, filament 2.
 *   - Index 3 → `"0C"`, filament 3. ...
 *
 * Exporter mapping: material slot N (our 0-based slot index in
 * `colorConfig.materials`) → filament N+1 (slicer 1-based) →
 * `FILAMENT_PAINT_CODES[N+1]`. So slot 0 (body) → `"4"` (filament 1),
 * slot 1 → `"8"` (filament 2), etc.
 *
 * PrusaSlicer reads the same `paint_color` attribute (3mf.cpp:2158) as a
 * fallback for its own `slic3rpe:mmu_segmentation`, so one emission path
 * covers Bambu/Orca/Prusa. The Materials Extension `<m:colorgroup>` was
 * dropped because Orca explicitly ignores triangle `pid`/`p1` (bbs_3mf.cpp
 * comment lines 3805–3810) and treats each colorgroup as a single object
 * color, not a multi-slot palette.
 *
 * Exported so test code can decode `paint_color` back to filament indices
 * without maintaining a duplicate copy of the table.
 */
export const FILAMENT_PAINT_CODES = [
  '',
  '4',
  '8',
  '0C',
  '1C',
  '2C',
  '3C',
  '4C',
  '5C',
  '6C',
  '7C',
  '8C',
  '9C',
  'AC',
  'BC',
  'CC',
  'DC',
] as const;
// One fewer than the table size because we index `[slot + 1]` (slot 0 = filament 1).
const MAX_COLOR_SLOTS = FILAMENT_PAINT_CODES.length - 1;

/**
 * Version we claim in the `Application` metadata, gated to multi-color
 * exports. The claim has to start with "BambuStudio-" because BambuStudio's
 * `dont_load_config` gate at bbs_3mf.cpp:1898-1908 only loads our
 * `project_settings.config` sidecar when that prefix matches — without it
 * the AMS palette isn't pre-filled and Bambu shows a "not from Bambu Lab"
 * dialog.
 *
 * Picking the exact version was empirically constrained:
 *
 *   - `01.x.x.x` is rejected outright by OrcaSlicer's CLI version check
 *     (`Version Check: File Version 1.x.x.x not supported by current cli
 *     version 2.3.1`, exit -24). The check has a hidden minimum beyond the
 *     maj/min compare in OrcaSlicer.cpp:1589 — I couldn't reproduce the
 *     reject from reading the source, but it fires reliably for any 1.x.
 *   - `02.06.x.x` and higher trip Orca 2.3's "file is newer than cli"
 *     branch and also reject.
 *   - `02.00.00.00` lands in the sweet spot: Bambu's gate accepts it,
 *     Orca's version check accepts it, and the file_version stays under
 *     every Bambu release we'd care about so the slicer doesn't run the
 *     "translate old project" migration path.
 *
 * If beginners are running Orca 1.x (unlikely — it's the 2023 series and
 * mostly unmaintained) the file will reject. The trade-off is favorable
 * for the modern install base.
 */
export const BAMBU_COMPAT_APPLICATION = 'BambuStudio-02.00.00.00';

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

/**
 * Validates color hex format and triangle index range. Caps at the size of
 * OrcaSlicer's CONST_FILAMENTS table — going past it would emit a paint_color
 * string the slicer can't decode.
 */
export function assertColorConfigShape(config: ThreeMFColorConfig, triangleCount: number): void {
  if (config.triangleMaterialIndices.length !== triangleCount) {
    throw new Error(
      `3MF color config: triangleMaterialIndices length ${config.triangleMaterialIndices.length} does not match triangle count ${triangleCount}`
    );
  }
  const slotCount = config.materials.length;
  if (slotCount > MAX_COLOR_SLOTS) {
    throw new Error(
      `3MF color config: ${slotCount} colors exceeds slicer filament cap of ${MAX_COLOR_SLOTS}`
    );
  }
  for (let i = 0; i < config.triangleMaterialIndices.length; i++) {
    const idx = config.triangleMaterialIndices[i];
    if (!Number.isInteger(idx) || idx < 0 || idx >= slotCount) {
      throw new Error(
        `3MF color config: triangle ${i} index ${idx} out of range [0, ${slotCount})`
      );
    }
  }
  for (let i = 0; i < config.materials.length; i++) {
    const color = config.materials[i].color;
    if (!HEX_COLOR_RE.test(color)) {
      throw new Error(
        `3MF color config: material ${i} color "${color}" is not in #RRGGBB or #RRGGBBAA format`
      );
    }
  }
}
