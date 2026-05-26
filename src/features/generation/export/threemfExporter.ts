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

function packageFiles(modelXml: string, thumbnail: Uint8Array | undefined): Uint8Array {
  const hasThumbnail = !!thumbnail;
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(buildContentTypes(hasThumbnail)),
    '_rels/.rels': strToU8(buildRelationships(hasThumbnail)),
    '3D/3dmodel.model': strToU8(modelXml),
  };
  if (thumbnail) {
    files['Metadata/thumbnail.png'] = thumbnail;
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

  return packageFiles(buildMultiObjectModelXML(meshes, options), options.thumbnail);
}

export function build3MFBuffer(
  vertices: Float32Array,
  normals: Float32Array,
  options: ThreeMFOptions
): Uint8Array {
  validateMeshData(vertices, normals);
  const mesh = deduplicateVertices(vertices);
  return packageFiles(buildModelXML(mesh, options), options.thumbnail);
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

function buildModelXML(mesh: IndexedMesh, options: ThreeMFOptions): string {
  const colorConfig = activeColorConfig(options.colorConfig);
  if (colorConfig) {
    assertColorConfigShape(colorConfig, mesh.triangles.length);
  }

  // IDs assigned in ascending document order per 3MF Core Spec §4.1.2;
  // the colorgroup MUST precede the object that references it via pid.
  const COLORGROUP_ID = 1;
  const objectId = colorConfig ? 2 : 1;

  let xml = openModelElement(!!colorConfig);
  xml += buildMetadataXml(options);
  xml += '  <resources>\n';
  if (colorConfig) {
    xml += buildColorGroupXml(COLORGROUP_ID, colorConfig.materials);
  }
  xml += buildObjectXml(
    objectId,
    options.name,
    mesh,
    colorConfig ? { id: COLORGROUP_ID, indices: colorConfig.triangleMaterialIndices } : null
  );
  xml += '  </resources>\n';
  xml += '  <build>\n';
  xml += renderBuildItems(objectId, options.stack);
  xml += '  </build>\n';
  xml += '</model>';
  return xml;
}

/**
 * 3MF transforms are row-major 3×4 (`m11..m13 m21..m23 m31..m33 m41..m43`);
 * the trailing m41/m42/m43 row carries the translation. Stacking is a pure
 * Z translation, so the rotation/scale block stays identity and only m43
 * changes per copy.
 */
function renderBuildItems(objectId: number, stack: ThreeMFOptions['stack']): string {
  const count = stack && stack.count > 1 ? Math.floor(stack.count) : 1;
  if (count === 1) {
    return `    <item objectid="${objectId}" />\n`;
  }

  const stride = (stack?.zHeightMm ?? 0) + (stack?.spacingMm ?? 0);
  let out = '';
  for (let i = 0; i < count; i++) {
    const dz = formatFloat(i * stride);
    out += `    <item objectid="${objectId}" transform="1 0 0 0 1 0 0 0 1 0 0 ${dz}" />\n`;
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

  let xml = openModelElement(anyHasColors);
  xml += buildMetadataXml(options);
  xml += '  <resources>\n';

  const objectIds: number[] = [];
  let nextId = 1;
  for (const obj of resolved) {
    let colorGroup: { id: number; indices: readonly number[] } | null = null;
    if (obj.colorConfig) {
      const colorGroupId = nextId++;
      xml += buildColorGroupXml(colorGroupId, obj.colorConfig.materials);
      colorGroup = { id: colorGroupId, indices: obj.colorConfig.triangleMaterialIndices };
    }
    const objectId = nextId++;
    objectIds.push(objectId);
    xml += buildObjectXml(objectId, obj.name, obj.mesh, colorGroup);
  }

  xml += '  </resources>\n';
  xml += '  <build>\n';
  for (const id of objectIds) {
    xml += `    <item objectid="${id}" />\n`;
  }
  xml += '  </build>\n';
  xml += '</model>';
  return xml;
}

const CORE_NS = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';
const MATERIAL_NS = 'http://schemas.microsoft.com/3dmanufacturing/material/2015/02';

/**
 * The `m` materials extension is what BambuStudio/OrcaSlicer parse for their
 * "Standard 3MF Import Color" dialog — the 3MF Core `<basematerials>` element
 * is silently ignored by their parsers. Declare the extension only when we
 * actually emit color content, so single-color exports stay namespace-clean.
 */
function openModelElement(hasColors: boolean): string {
  const matNs = hasColors ? ` xmlns:m="${MATERIAL_NS}" requiredextensions="m"` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="${CORE_NS}"${matNs}>\n`;
}

function buildMetadataXml(options: ThreeMFOptions): string {
  let xml = `  <metadata name="Title">${escapeXml(options.name)}</metadata>\n`;
  xml += '  <metadata name="Designer">Gridfinity Layout Tool</metadata>\n';
  xml += `  <metadata name="CreationDate">${new Date().toISOString().split('T')[0]}</metadata>\n`;
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

function buildColorGroupXml(id: number, materials: ThreeMFColorConfig['materials']): string {
  let xml = `    <m:colorgroup id="${id}">\n`;
  for (const mat of materials) {
    xml += `      <m:color color="${escapeXml(mat.color)}" />\n`;
  }
  xml += '    </m:colorgroup>\n';
  return xml;
}

function buildObjectXml(
  objectId: number,
  name: string,
  mesh: IndexedMesh,
  colorGroup: { id: number; indices: readonly number[] } | null
): string {
  let xml = `    <object id="${objectId}" type="model" name="${escapeXml(name)}">\n`;
  xml += '      <mesh>\n        <vertices>\n';
  for (const [x, y, z] of mesh.vertices) {
    xml += `          <vertex x="${formatFloat(x)}" y="${formatFloat(y)}" z="${formatFloat(z)}" />\n`;
  }
  xml += '        </vertices>\n        <triangles>\n';
  if (colorGroup) {
    const { id, indices } = colorGroup;
    for (let i = 0; i < mesh.triangles.length; i++) {
      const [v1, v2, v3] = mesh.triangles[i];
      xml += `          <triangle v1="${v1}" v2="${v2}" v3="${v3}" pid="${id}" p1="${indices[i]}" />\n`;
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
 * Materials Extension v1.0 requires `#RRGGBB` or `#RRGGBBAA` (sRGB hex with
 * leading `#`); `triangleMaterialIndices` must have exactly one entry per
 * triangle, each pointing at a valid color slot. Violations throw so that
 * out-of-range or missing entries can't silently ship as wrong colors.
 */
function assertColorConfigShape(config: ThreeMFColorConfig, triangleCount: number): void {
  if (config.triangleMaterialIndices.length !== triangleCount) {
    throw new Error(
      `3MF color config: triangleMaterialIndices length ${config.triangleMaterialIndices.length} does not match triangle count ${triangleCount}`
    );
  }
  const slotCount = config.materials.length;
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
