import type { ThreeMFObject, ThreeMFOptions } from './threemfTypes';
import { validateMeshData } from './validation';
import { deduplicateVertices } from './threemfGeometry';
import {
  buildModelSettingsConfig,
  buildProjectSettingsConfig,
  unifyColorConfigs,
} from './threemfColor';
import { buildModelXML, buildMultiObjectModelXML } from './threemfXml';
import { packageFiles, THREEMF_MIME, toArrayBuffer } from './threemfPackage';

export type {
  ThreeMFColorConfig,
  ThreeMFObject,
  ThreeMFOptions,
  ThreeMFPrintSettings,
} from './threemfTypes';
export { deduplicateVertices } from './threemfGeometry';
export { FILAMENT_PAINT_CODES } from './threemfColor';

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

export function build3MFMultiObjectBuffer(
  objects: readonly ThreeMFObject[],
  options: ThreeMFOptions
): Uint8Array {
  for (const obj of objects) {
    validateMeshData(obj.vertices, obj.normals);
  }

  const unified = unifyColorConfigs(objects.map((obj) => obj.colorConfig));
  const meshes = objects.map((obj, i) => ({
    mesh: deduplicateVertices(obj.vertices),
    name: obj.name,
    colorConfig: unified.configs[i],
    placement: obj.placement,
  }));

  return packageFiles(
    buildMultiObjectModelXML(meshes, options),
    options.thumbnail,
    unified.palette && buildProjectSettingsConfig(unified.palette),
    buildModelSettingsConfig(meshes)
  );
}

export function build3MFBuffer(
  vertices: Float32Array,
  normals: Float32Array,
  options: ThreeMFOptions
): Uint8Array {
  validateMeshData(vertices, normals);
  const mesh = deduplicateVertices(vertices);
  const { palette } = unifyColorConfigs([options.colorConfig]);
  return packageFiles(
    buildModelXML(mesh, options),
    options.thumbnail,
    palette && buildProjectSettingsConfig(palette)
  );
}

export function estimate3MFFileSize(triangleCount: number): number {
  // Each triangle ~80 chars in XML, ~30 after ZIP deflate; ~1KB fixed overhead.
  return 1024 + triangleCount * 30;
}
