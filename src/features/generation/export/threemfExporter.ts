import { zipSync, strToU8 } from 'fflate';
import { validateMeshData } from './validation';

export interface ThreeMFColorConfig {
  readonly materials: readonly { readonly color: string }[];
  readonly triangleMaterialIndices: readonly number[];
}

export interface ThreeMFObject {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly name: string;
  readonly colorConfig?: ThreeMFColorConfig;
}

export interface ThreeMFOptions {
  readonly name: string;
  readonly thumbnail?: Uint8Array;
  readonly printSettings?: ThreeMFPrintSettings;
  readonly colorConfig?: ThreeMFColorConfig;
  /**
   * Vertical stacking — the mesh is emitted once and referenced by `count`
   * build items, each translated by `i * (zHeightMm + spacingMm)` along Z so
   * slicers see each instance as a separate placement (issue #1642).
   * Honored by single-object export only; `export3MFMultiObject` ignores it
   * since stacking a heterogeneous bin + lid pair has no slicer interpretation.
   */
  readonly stack?: {
    readonly count: number;
    readonly zHeightMm: number;
    readonly spacingMm: number;
  };
}

export interface ThreeMFPrintSettings {
  readonly layerHeight?: number;
  readonly infillPercent?: number;
  readonly material?: string;
  readonly supportRequired?: boolean;
  readonly estimatedMinutes?: number;
  readonly estimatedGrams?: number;
}

interface IndexedMesh {
  readonly vertices: readonly [number, number, number][];
  readonly triangles: readonly [number, number, number][];
}

const THREEMF_MIME = 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml';

export function export3MF(
  vertices: Float32Array,
  normals: Float32Array,
  options: ThreeMFOptions
): Blob {
  const buffer = build3MFBuffer(vertices, normals, options);
  return new Blob([toArrayBuffer(buffer)], { type: THREEMF_MIME });
}

export function export3MFMultiObject(
  objects: readonly ThreeMFObject[],
  options: ThreeMFOptions
): Blob {
  const buffer = build3MFMultiObjectBuffer(objects, options);
  return new Blob([toArrayBuffer(buffer)], { type: THREEMF_MIME });
}

function packageFiles(
  modelXml: string,
  thumbnail: Uint8Array | undefined,
  projectSettingsJson: string | undefined
): Uint8Array {
  const hasThumbnail = !!thumbnail;
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(buildContentTypes(hasThumbnail)),
    '_rels/.rels': strToU8(buildRelationships(hasThumbnail)),
    '3D/3dmodel.model': strToU8(modelXml),
  };
  if (thumbnail) {
    files['Metadata/thumbnail.png'] = thumbnail;
  }
  if (projectSettingsJson) {
    // Both OrcaSlicer and BambuStudio read this via
    // `_extract_project_config_from_archive` and apply `filament_colour` to
    // their AMS slots, so the user opens the file with the bin's zone
    // palette already pre-filled. BambuStudio additionally gates the loader
    // on an `Application=BambuStudio-X.Y.Z` metadata claim — see
    // BAMBU_COMPAT_APPLICATION below — without which Bambu silently skips
    // the sidecar and shows a "not from Bambu Lab" dialog instead.
    files['Metadata/project_settings.config'] = strToU8(projectSettingsJson);
  }
  return zipSync(files, { level: 6 });
}

export function build3MFMultiObjectBuffer(
  objects: readonly ThreeMFObject[],
  options: ThreeMFOptions
): Uint8Array {
  for (const obj of objects) {
    validateMeshData(obj.vertices, obj.normals);
  }

  const meshes = objects.map((obj) => ({
    mesh: deduplicateVertices(obj.vertices),
    name: obj.name,
    colorConfig: obj.colorConfig,
  }));

  const palette = unifiedPalette(meshes.map((m) => m.colorConfig));
  return packageFiles(
    buildMultiObjectModelXML(meshes, options),
    options.thumbnail,
    palette && buildProjectSettingsConfig(palette)
  );
}

export function build3MFBuffer(
  vertices: Float32Array,
  normals: Float32Array,
  options: ThreeMFOptions
): Uint8Array {
  validateMeshData(vertices, normals);
  const mesh = deduplicateVertices(vertices);
  const palette = unifiedPalette([options.colorConfig]);
  return packageFiles(
    buildModelXML(mesh, options),
    options.thumbnail,
    palette && buildProjectSettingsConfig(palette)
  );
}

/**
 * Vertices within 1e-6 (key precision = 6 decimal places) are considered
 * identical — the hash key uses `toFixed` so floating-point jitter from
 * boolean operations doesn't fragment otherwise-shared vertices.
 */
export function deduplicateVertices(vertices: Float32Array): IndexedMesh {
  const PRECISION = 6;
  const uniqueVertices: [number, number, number][] = [];
  const triangles: [number, number, number][] = [];
  const vertexMap = new Map<string, number>();

  const triangleCount = vertices.length / 9;

  for (let tri = 0; tri < triangleCount; tri++) {
    const indices: [number, number, number] = [0, 0, 0];

    for (let v = 0; v < 3; v++) {
      const base = tri * 9 + v * 3;
      const x = vertices[base];
      const y = vertices[base + 1];
      const z = vertices[base + 2];
      const key = `${x.toFixed(PRECISION)},${y.toFixed(PRECISION)},${z.toFixed(PRECISION)}`;

      let index = vertexMap.get(key);
      if (index === undefined) {
        index = uniqueVertices.length;
        uniqueVertices.push([x, y, z]);
        vertexMap.set(key, index);
      }
      indices[v] = index;
    }

    triangles.push(indices);
  }

  return { vertices: uniqueVertices, triangles };
}

function buildContentTypes(hasThumbnail: boolean): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />',
    // Override (specific path) rather than Default (extension) for the model
    // file — PrusaSlicer and friends generate Override; some parsers only
    // handle Override.
    `  <Override PartName="/3D/3dmodel.model" ContentType="${THREEMF_MIME}" />`,
  ];
  if (hasThumbnail) {
    lines.push('  <Default Extension="png" ContentType="image/png" />');
  }
  lines.push('</Types>');
  return lines.join('\n');
}

function buildRelationships(hasThumbnail: boolean): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '  <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />',
  ];
  if (hasThumbnail) {
    // OPC §11.3 thumbnail relationship — without this, viewers can't discover
    // the PNG even though Content_Types declares its MIME type.
    lines.push(
      '  <Relationship Target="/Metadata/thumbnail.png" Id="rel-2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail" />'
    );
  }
  lines.push('</Relationships>');
  return lines.join('\n');
}

function activeColorConfig(c: ThreeMFColorConfig | undefined): ThreeMFColorConfig | undefined {
  return c && c.materials.length > 0 ? c : undefined;
}

/**
 * Resolve the palette emitted into `Metadata/project_settings.config` from one
 * or more colorConfigs. Returns undefined when no palette would be emitted —
 * single-color exports skip the sidecar entirely.
 *
 * **Invariant:** every colored object in a multi-object export must share the
 * same materials array (same order, same colors). Per-triangle `paint_color`
 * codes are object-local references into the object's own slot list, so two
 * objects with differently-ordered palettes would resolve the same code to
 * different filaments in the unified `filament_colour` list. Throws on
 * mismatch rather than silently producing wrong colors. Today only the bin
 * carries a colorConfig in the multi-object path, but locking down the
 * invariant lets that change safely later.
 */
function unifiedPalette(
  configs: readonly (ThreeMFColorConfig | undefined)[]
): readonly string[] | undefined {
  const actives = configs
    .map(activeColorConfig)
    .filter((c): c is ThreeMFColorConfig => c !== undefined);
  if (actives.length === 0) return undefined;

  const first = actives[0].materials;
  for (let i = 1; i < actives.length; i++) {
    if (!materialsMatch(first, actives[i].materials)) {
      throw new Error(
        '3MF multi-object: all colored objects must share the same materials array (same order, same colors); ' +
          'per-object paint_color slot indices would otherwise misalign with the unified filament palette.'
      );
    }
  }
  return first.map((m) => m.color.toLowerCase());
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
function buildProjectSettingsConfig(palette: readonly string[]): string {
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
    },
    null,
    2
  );
}

function buildModelXML(mesh: IndexedMesh, options: ThreeMFOptions): string {
  const colorConfig = activeColorConfig(options.colorConfig);
  if (colorConfig) {
    assertColorConfigShape(colorConfig, mesh.triangles.length);
  }

  const objectId = 1;
  const offset = centeringTranslation(computeBBox(mesh.vertices));

  let xml = openModelElement();
  xml += buildMetadataXml(options, { bambuCompat: !!colorConfig });
  xml += '  <resources>\n';
  xml += buildObjectXml(objectId, options.name, mesh, colorConfig?.triangleMaterialIndices);
  xml += '  </resources>\n';
  xml += '  <build>\n';
  xml += renderBuildItems(objectId, options.stack, offset);
  xml += '  </build>\n';
  xml += '</model>';
  return xml;
}

/**
 * Plate-center coordinates we translate the bin's bbox centroid to so the
 * file opens centered on the bed. Chosen for the 256×256 mm beds that
 * BambuStudio A1/X1/P1, Prusa MK4S, and similar most commonly target.
 * A1 mini (180×180) will see the bin offset 38mm past center — still on
 * the bed. Pre-#1893 we shipped no Application metadata so OrcaSlicer
 * classified our file as `From_Other` and auto-arranged on import;
 * claiming BambuStudio identity flips `need_arrange = false` in the BBS
 * loader, so we now have to provide the plate position ourselves.
 */
const PLATE_CENTER_MM = { x: 128, y: 128 } as const;

interface BBox {
  readonly min: { x: number; y: number; z: number };
  readonly max: { x: number; y: number; z: number };
}

function computeBBox(vertices: readonly (readonly [number, number, number])[]): BBox | null {
  if (vertices.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (const [x, y, z] of vertices) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
}

/**
 * Translation that places the bbox centroid at PLATE_CENTER_MM (XY) and
 * the bottom of the bbox at z=0 (sits on bed). Returns zero for an empty
 * bbox — let the slicer do whatever it does with an empty mesh.
 */
function centeringTranslation(bbox: BBox | null): { x: number; y: number; z: number } {
  if (!bbox) return { x: 0, y: 0, z: 0 };
  return {
    x: PLATE_CENTER_MM.x - (bbox.min.x + bbox.max.x) / 2,
    y: PLATE_CENTER_MM.y - (bbox.min.y + bbox.max.y) / 2,
    z: -bbox.min.z,
  };
}

/**
 * 3MF transforms are row-major 3×4 (`m11..m13 m21..m23 m31..m33 m41..m43`);
 * the trailing m41/m42/m43 row carries the translation. Stacking is a pure
 * Z translation on top of the base centering offset, so the rotation/scale
 * block stays identity and only m41/m42/m43 vary per copy.
 */
function renderBuildItems(
  objectId: number,
  stack: ThreeMFOptions['stack'],
  offset: { x: number; y: number; z: number }
): string {
  const count = stack && stack.count > 1 ? Math.floor(stack.count) : 1;
  const stride = (stack?.zHeightMm ?? 0) + (stack?.spacingMm ?? 0);
  // tx/ty don't change across stack copies — only the Z stride does — so
  // format them once outside the loop.
  const tx = formatFloat(offset.x);
  const ty = formatFloat(offset.y);
  let out = '';
  for (let i = 0; i < count; i++) {
    const tz = formatFloat(offset.z + i * stride);
    out += `    <item objectid="${objectId}" transform="1 0 0 0 1 0 0 0 1 ${tx} ${ty} ${tz}" />\n`;
  }
  return out;
}

function buildMultiObjectModelXML(
  objects: readonly {
    mesh: IndexedMesh;
    name: string;
    colorConfig?: ThreeMFColorConfig;
  }[],
  options: ThreeMFOptions
): string {
  // Validate every color config up front so an invalid config on object N
  // can't cost the serialisation of objects 0…N-1.
  const resolved = objects.map((obj) => {
    const colorConfig = activeColorConfig(obj.colorConfig);
    if (colorConfig) {
      assertColorConfigShape(colorConfig, obj.mesh.triangles.length);
    }
    return { ...obj, colorConfig };
  });

  const anyHasColors = resolved.some((obj) => obj.colorConfig !== undefined);

  // Single shared offset across all objects so the bin + dividers + lid keep
  // their relative positions and the assembly lands centered together.
  const combinedBBox = mergeBBoxes(resolved.map((obj) => computeBBox(obj.mesh.vertices)));
  const offset = centeringTranslation(combinedBBox);

  let xml = openModelElement();
  xml += buildMetadataXml(options, { bambuCompat: anyHasColors });
  xml += '  <resources>\n';

  const objectIds: number[] = [];
  let nextId = 1;
  for (const obj of resolved) {
    const objectId = nextId++;
    objectIds.push(objectId);
    xml += buildObjectXml(objectId, obj.name, obj.mesh, obj.colorConfig?.triangleMaterialIndices);
  }

  xml += '  </resources>\n';
  xml += '  <build>\n';
  const tx = formatFloat(offset.x);
  const ty = formatFloat(offset.y);
  const tz = formatFloat(offset.z);
  for (const id of objectIds) {
    xml += `    <item objectid="${id}" transform="1 0 0 0 1 0 0 0 1 ${tx} ${ty} ${tz}" />\n`;
  }
  xml += '  </build>\n';
  xml += '</model>';
  return xml;
}

function mergeBBoxes(boxes: readonly (BBox | null)[]): BBox | null {
  let merged: BBox | null = null;
  for (const b of boxes) {
    if (!b) continue;
    if (!merged) {
      merged = b;
      continue;
    }
    merged = {
      min: {
        x: Math.min(merged.min.x, b.min.x),
        y: Math.min(merged.min.y, b.min.y),
        z: Math.min(merged.min.z, b.min.z),
      },
      max: {
        x: Math.max(merged.max.x, b.max.x),
        y: Math.max(merged.max.y, b.max.y),
        z: Math.max(merged.max.z, b.max.z),
      },
    };
  }
  return merged;
}

const CORE_NS = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';

function openModelElement(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="${CORE_NS}">\n`;
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
const BAMBU_COMPAT_APPLICATION = 'BambuStudio-02.00.00.00';

function buildMetadataXml(options: ThreeMFOptions, flags: { bambuCompat: boolean }): string {
  let xml = `  <metadata name="Title">${escapeXml(options.name)}</metadata>\n`;
  xml += '  <metadata name="Designer">Gridfinity Layout Tool</metadata>\n';
  xml += `  <metadata name="CreationDate">${new Date().toISOString().split('T')[0]}</metadata>\n`;
  if (flags.bambuCompat) {
    xml += `  <metadata name="Application">${BAMBU_COMPAT_APPLICATION}</metadata>\n`;
    xml += '  <metadata name="BambuStudio:3mfVersion">1</metadata>\n';
  }
  const ps = options.printSettings;
  if (!ps) return xml;
  // 3MF Core §3.7: custom metadata names without a registered namespace prefix
  // should set preserve="true" so consumers don't strip them on round-trip.
  const custom = (name: string, value: string | number | boolean) =>
    `  <metadata name="${name}" preserve="true">${value}</metadata>\n`;
  if (ps.layerHeight !== undefined) xml += custom('PrintSettings.LayerHeight', ps.layerHeight);
  if (ps.infillPercent !== undefined)
    xml += custom('PrintSettings.InfillPercent', ps.infillPercent);
  if (ps.material) xml += custom('PrintSettings.Material', escapeXml(ps.material));
  if (ps.supportRequired !== undefined)
    xml += custom('PrintSettings.SupportRequired', ps.supportRequired);
  if (ps.estimatedMinutes !== undefined)
    xml += custom('PrintSettings.EstimatedMinutes', ps.estimatedMinutes);
  if (ps.estimatedGrams !== undefined)
    xml += custom('PrintSettings.EstimatedGrams', ps.estimatedGrams);
  return xml;
}

function buildObjectXml(
  objectId: number,
  name: string,
  mesh: IndexedMesh,
  triangleMaterialIndices: readonly number[] | undefined
): string {
  let xml = `    <object id="${objectId}" type="model" name="${escapeXml(name)}">\n`;
  xml += '      <mesh>\n        <vertices>\n';
  for (const [x, y, z] of mesh.vertices) {
    xml += `          <vertex x="${formatFloat(x)}" y="${formatFloat(y)}" z="${formatFloat(z)}" />\n`;
  }
  xml += '        </vertices>\n        <triangles>\n';
  if (triangleMaterialIndices) {
    for (let i = 0; i < mesh.triangles.length; i++) {
      const [v1, v2, v3] = mesh.triangles[i];
      // Map material slot N to filament N+1 in the slicer (1-based) so each
      // zone lands on its own AMS slot — slot 0 → "4" (filament 1, body),
      // slot 1 → "8" (filament 2, lip), slot 2 → "0C" (filament 3), etc.
      // Earlier passes omitted paint_color for slot 0 intending to fall
      // through to the object's default extruder, but the default IS filament
      // 1, so body (no attribute) and lip (paint_color="4" = filament 1)
      // collapsed onto the same physical filament — making 4-zone exports
      // appear as 2 colors in the slicer. Explicit attribute for every
      // triangle decouples zone-to-filament mapping from the default-extruder
      // setting, which the user can re-set per object without color drift.
      const code = FILAMENT_PAINT_CODES[triangleMaterialIndices[i] + 1];
      xml += `          <triangle v1="${v1}" v2="${v2}" v3="${v3}" paint_color="${code}" />\n`;
    }
  } else {
    for (const [v1, v2, v3] of mesh.triangles) {
      xml += `          <triangle v1="${v1}" v2="${v2}" v3="${v3}" />\n`;
    }
  }
  xml += '        </triangles>\n      </mesh>\n    </object>\n';
  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

/**
 * Validates color hex format and triangle index range. Caps at the size of
 * OrcaSlicer's CONST_FILAMENTS table — going past it would emit a paint_color
 * string the slicer can't decode.
 */
function assertColorConfigShape(config: ThreeMFColorConfig, triangleCount: number): void {
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

/**
 * fflate's browser WASM path can return a Uint8Array backed by a larger
 * pre-allocated ArrayBuffer. Slicing to the view's range avoids trailing
 * garbage and produces an ArrayBuffer (not ArrayBufferLike) which satisfies
 * the TS6 BlobPart constraint.
 */
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

function formatFloat(n: number): string {
  return parseFloat(n.toFixed(6)).toString();
}

export function estimate3MFFileSize(triangleCount: number): number {
  // Each triangle ~80 chars in XML, ~30 after ZIP deflate; ~1KB fixed overhead.
  return 1024 + triangleCount * 30;
}
