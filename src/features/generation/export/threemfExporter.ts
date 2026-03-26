/**
 * 3MF file exporter (3D Manufacturing Format).
 *
 * Produces a valid OPC (Open Packaging Conventions) ZIP archive containing:
 * - [Content_Types].xml — MIME type declarations
 * - _rels/.rels — Package relationships
 * - 3D/3dmodel.model — Mesh data + metadata in XML
 * - Metadata/thumbnail.png (optional) — Preview image
 *
 * The mesh is stored in indexed format (unique vertices + triangle indices),
 * converted from the flat STL-style vertex arrays used by the generation engine.
 *
 * Spec: https://3mf.io/specification/
 */

import { zipSync, strToU8 } from 'fflate';
import { validateMeshData } from './validation';

/** Multi-material color configuration for 3MF basematerials extension */
export interface ThreeMFColorConfig {
  /** Deduplicated materials list (name + displaycolor) */
  readonly materials: readonly { readonly name: string; readonly color: string }[];
  /** Per-triangle material index into the materials array (length = triangle count) */
  readonly triangleMaterialIndices: readonly number[];
}

/** A single mesh object for multi-object 3MF export */
export interface ThreeMFObject {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly name: string;
  readonly colorConfig?: ThreeMFColorConfig;
}

/** Options for 3MF export */
export interface ThreeMFOptions {
  /** Model name for metadata */
  readonly name: string;
  /** Optional thumbnail PNG as Uint8Array */
  readonly thumbnail?: Uint8Array;
  /** Optional print settings hints (embedded as metadata) */
  readonly printSettings?: ThreeMFPrintSettings;
  /** Optional multi-material color configuration */
  readonly colorConfig?: ThreeMFColorConfig;
}

/** Suggested print settings embedded as metadata */
export interface ThreeMFPrintSettings {
  readonly layerHeight?: number;
  readonly infillPercent?: number;
  readonly material?: string;
  readonly supportRequired?: boolean;
  readonly estimatedMinutes?: number;
  readonly estimatedGrams?: number;
}

/**
 * Indexed mesh representation for 3MF XML.
 * Deduplicated from flat STL-style arrays.
 */
interface IndexedMesh {
  readonly vertices: readonly [number, number, number][];
  readonly triangles: readonly [number, number, number][];
}

/**
 * Generates a 3MF file Blob from mesh data.
 *
 * @param vertices - Flat vertex array (every 9 floats = 1 triangle)
 * @param normals - Flat normal array (unused in 3MF, but validated for consistency)
 * @param options - Export options (name, thumbnail, print settings)
 * @returns 3MF file as a Blob
 *
 * @throws If vertex count is not divisible by 9
 * @throws If normals length doesn't match vertices length
 */
export function export3MF(
  vertices: Float32Array,
  normals: Float32Array,
  options: ThreeMFOptions
): Blob {
  const buffer = build3MFBuffer(vertices, normals, options);
  return new Blob([buffer.buffer.slice(0) as ArrayBuffer], {
    type: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
  });
}

/**
 * Generates a 3MF file Blob containing multiple named objects.
 *
 * Each object gets its own `<object>` element with a unique id and name,
 * all referenced in the `<build>` section. This allows slicers to display
 * each piece (bin, dividers) as a separate named object.
 */
export function export3MFMultiObject(
  objects: readonly ThreeMFObject[],
  options: ThreeMFOptions
): Blob {
  const buffer = build3MFMultiObjectBuffer(objects, options);
  return new Blob([buffer.buffer.slice(0) as ArrayBuffer], {
    type: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
  });
}

/**
 * Builds the raw multi-object 3MF ZIP as a Uint8Array.
 * Exposed separately for testing.
 */
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

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(buildContentTypes(!!options.thumbnail)),
    '_rels/.rels': strToU8(buildRelationships()),
    '3D/3dmodel.model': strToU8(buildMultiObjectModelXML(meshes, options)),
  };

  if (options.thumbnail) {
    files['Metadata/thumbnail.png'] = options.thumbnail;
  }

  return zipSync(files, { level: 6 });
}

/**
 * Builds the raw 3MF ZIP as a Uint8Array.
 * Exposed separately for testing.
 */
export function build3MFBuffer(
  vertices: Float32Array,
  normals: Float32Array,
  options: ThreeMFOptions
): Uint8Array {
  validateMeshData(vertices, normals);

  // Convert flat arrays to indexed mesh
  const mesh = deduplicateVertices(vertices);

  // Build ZIP entries
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(buildContentTypes(!!options.thumbnail)),
    '_rels/.rels': strToU8(buildRelationships()),
    '3D/3dmodel.model': strToU8(buildModelXML(mesh, options)),
  };

  if (options.thumbnail) {
    files['Metadata/thumbnail.png'] = options.thumbnail;
  }

  return zipSync(files, { level: 6 });
}

/**
 * Deduplicates vertices from a flat triangle array into indexed format.
 *
 * Uses a spatial hash map for O(n) deduplication. Vertices within
 * floating-point epsilon (1e-6) are considered identical.
 */
export function deduplicateVertices(vertices: Float32Array): IndexedMesh {
  const PRECISION = 6; // Decimal places for hash key
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

      // Hash key with fixed precision to handle floating point
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
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n';
  xml +=
    '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />\n';
  // Use Override (specific path) rather than Default (extension) for the model file.
  // PrusaSlicer and other slicers generate Override elements; some parsers only handle Override.
  xml +=
    '  <Override PartName="/3D/3dmodel.model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />\n';
  if (hasThumbnail) {
    xml += '  <Default Extension="png" ContentType="image/png" />\n';
  }
  xml += '</Types>';
  return xml;
}

function buildRelationships(): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n';
  xml +=
    '  <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />\n';
  xml += '</Relationships>';
  return xml;
}

function buildModelXML(mesh: IndexedMesh, options: ThreeMFOptions): string {
  const NS = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';
  const hasColors = options.colorConfig && options.colorConfig.materials.length > 0;

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<model unit="millimeter" xml:lang="en-US" xmlns="${NS}">\n`;

  // Metadata
  xml += `  <metadata name="Title">${escapeXml(options.name)}</metadata>\n`;
  xml += '  <metadata name="Designer">Gridfinity Layout Tool</metadata>\n';
  xml += `  <metadata name="CreationDate">${new Date().toISOString().split('T')[0]}</metadata>\n`;

  // Print settings as custom metadata
  if (options.printSettings) {
    const ps = options.printSettings;
    if (ps.layerHeight !== undefined) {
      xml += `  <metadata name="PrintSettings.LayerHeight">${ps.layerHeight}</metadata>\n`;
    }
    if (ps.infillPercent !== undefined) {
      xml += `  <metadata name="PrintSettings.InfillPercent">${ps.infillPercent}</metadata>\n`;
    }
    if (ps.material) {
      xml += `  <metadata name="PrintSettings.Material">${escapeXml(ps.material)}</metadata>\n`;
    }
    if (ps.supportRequired !== undefined) {
      xml += `  <metadata name="PrintSettings.SupportRequired">${ps.supportRequired}</metadata>\n`;
    }
    if (ps.estimatedMinutes !== undefined) {
      xml += `  <metadata name="PrintSettings.EstimatedMinutes">${ps.estimatedMinutes}</metadata>\n`;
    }
    if (ps.estimatedGrams !== undefined) {
      xml += `  <metadata name="PrintSettings.EstimatedGrams">${ps.estimatedGrams}</metadata>\n`;
    }
  }

  // Resources
  xml += '  <resources>\n';

  // Basematerials resource (3MF Core Spec section 5.1 — no namespace prefix)
  // IDs assigned in ascending document order per 3MF Core Spec §4.1.2
  const BASEMATERIALS_ID = 1;
  const OBJECT_ID = 2;
  const colorConfig = hasColors ? options.colorConfig : undefined;
  if (colorConfig) {
    xml += `    <basematerials id="${BASEMATERIALS_ID}">\n`;
    for (const mat of colorConfig.materials) {
      xml += `      <base name="${escapeXml(mat.name)}" displaycolor="${escapeXml(mat.color)}" />\n`;
    }
    xml += '    </basematerials>\n';
  }

  xml += `    <object id="${colorConfig ? OBJECT_ID : 1}" type="model" name="${escapeXml(options.name)}">\n`;
  xml += '      <mesh>\n';

  // Vertices
  xml += '        <vertices>\n';
  for (const [x, y, z] of mesh.vertices) {
    xml += `          <vertex x="${formatFloat(x)}" y="${formatFloat(y)}" z="${formatFloat(z)}" />\n`;
  }
  xml += '        </vertices>\n';

  // Triangles
  xml += '        <triangles>\n';
  if (colorConfig) {
    const indices = colorConfig.triangleMaterialIndices;
    for (let i = 0; i < mesh.triangles.length; i++) {
      const [v1, v2, v3] = mesh.triangles[i];
      const pindex = indices[i] ?? 0;
      xml += `          <triangle v1="${v1}" v2="${v2}" v3="${v3}" pid="${BASEMATERIALS_ID}" p1="${pindex}" />\n`;
    }
  } else {
    for (const [v1, v2, v3] of mesh.triangles) {
      xml += `          <triangle v1="${v1}" v2="${v2}" v3="${v3}" />\n`;
    }
  }
  xml += '        </triangles>\n';

  xml += '      </mesh>\n';
  xml += '    </object>\n';
  xml += '  </resources>\n';

  // Build instructions
  xml += '  <build>\n';
  xml += `    <item objectid="${colorConfig ? OBJECT_ID : 1}" />\n`;
  xml += '  </build>\n';

  xml += '</model>';
  return xml;
}
function buildMultiObjectModelXML(
  objects: readonly {
    mesh: IndexedMesh;
    name: string;
    colorConfig?: ThreeMFColorConfig;
  }[],
  options: ThreeMFOptions
): string {
  const NS = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<model unit="millimeter" xml:lang="en-US" xmlns="${NS}">\n`;

  // Metadata
  xml += `  <metadata name="Title">${escapeXml(options.name)}</metadata>\n`;
  xml += '  <metadata name="Designer">Gridfinity Layout Tool</metadata>\n';
  xml += `  <metadata name="CreationDate">${new Date().toISOString().split('T')[0]}</metadata>\n`;

  if (options.printSettings) {
    const ps = options.printSettings;
    if (ps.layerHeight !== undefined) {
      xml += `  <metadata name="PrintSettings.LayerHeight">${ps.layerHeight}</metadata>\n`;
    }
    if (ps.infillPercent !== undefined) {
      xml += `  <metadata name="PrintSettings.InfillPercent">${ps.infillPercent}</metadata>\n`;
    }
    if (ps.material) {
      xml += `  <metadata name="PrintSettings.Material">${escapeXml(ps.material)}</metadata>\n`;
    }
    if (ps.supportRequired !== undefined) {
      xml += `  <metadata name="PrintSettings.SupportRequired">${ps.supportRequired}</metadata>\n`;
    }
    if (ps.estimatedMinutes !== undefined) {
      xml += `  <metadata name="PrintSettings.EstimatedMinutes">${ps.estimatedMinutes}</metadata>\n`;
    }
    if (ps.estimatedGrams !== undefined) {
      xml += `  <metadata name="PrintSettings.EstimatedGrams">${ps.estimatedGrams}</metadata>\n`;
    }
  }

  xml += '  <resources>\n';

  // Emit each object with a unique ID
  const objectIds: number[] = [];
  let nextId = 1;

  for (const obj of objects) {
    const hasColors = obj.colorConfig && obj.colorConfig.materials.length > 0;
    const colorConfig = hasColors ? obj.colorConfig : undefined;

    // Basematerials for this object (if colored)
    let baseMaterialsId: number | undefined;
    if (colorConfig) {
      baseMaterialsId = nextId++;
      xml += `    <basematerials id="${baseMaterialsId}">\n`;
      for (const mat of colorConfig.materials) {
        xml += `      <base name="${escapeXml(mat.name)}" displaycolor="${escapeXml(mat.color)}" />\n`;
      }
      xml += '    </basematerials>\n';
    }

    const objectId = nextId++;
    objectIds.push(objectId);

    xml += `    <object id="${objectId}" type="model" name="${escapeXml(obj.name)}">\n`;
    xml += '      <mesh>\n';

    xml += '        <vertices>\n';
    for (const [x, y, z] of obj.mesh.vertices) {
      xml += `          <vertex x="${formatFloat(x)}" y="${formatFloat(y)}" z="${formatFloat(z)}" />\n`;
    }
    xml += '        </vertices>\n';

    xml += '        <triangles>\n';
    if (colorConfig && baseMaterialsId !== undefined) {
      const indices = colorConfig.triangleMaterialIndices;
      for (let i = 0; i < obj.mesh.triangles.length; i++) {
        const [v1, v2, v3] = obj.mesh.triangles[i];
        const pindex = indices[i] ?? 0;
        xml += `          <triangle v1="${v1}" v2="${v2}" v3="${v3}" pid="${baseMaterialsId}" p1="${pindex}" />\n`;
      }
    } else {
      for (const [v1, v2, v3] of obj.mesh.triangles) {
        xml += `          <triangle v1="${v1}" v2="${v2}" v3="${v3}" />\n`;
      }
    }
    xml += '        </triangles>\n';

    xml += '      </mesh>\n';
    xml += '    </object>\n';
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Format float with up to 6 decimal places, removing trailing zeros.
 * 3MF spec requires reasonable precision without excessive digits.
 */
function formatFloat(n: number): string {
  return parseFloat(n.toFixed(6)).toString();
}

/**
 * Computes approximate file size for UI display.
 * Based on typical compression ratios for 3MF XML mesh data.
 */
export function estimate3MFFileSize(triangleCount: number): number {
  // Each triangle in XML ≈ 80 chars uncompressed, ~30 after ZIP deflate
  // Plus ~1KB fixed overhead for metadata/structure
  return 1024 + triangleCount * 30;
}
