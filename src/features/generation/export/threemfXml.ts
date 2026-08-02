import type { IndexedMesh, ThreeMFColorConfig, ThreeMFOptions } from './threemfTypes';
import { centeringTranslation, computeBBox, mergeBBoxes } from './threemfGeometry';
import {
  activeColorConfig,
  assertColorConfigShape,
  BAMBU_COMPAT_APPLICATION,
  FILAMENT_PAINT_CODES,
} from './threemfColor';

const CORE_NS = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';

function openModelElement(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="${CORE_NS}">\n`;
}

export function buildModelXML(mesh: IndexedMesh, options: ThreeMFOptions): string {
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

export function buildMultiObjectModelXML(
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

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatFloat(n: number): string {
  return parseFloat(n.toFixed(6)).toString();
}
