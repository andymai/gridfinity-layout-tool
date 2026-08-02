import { zipSync, strToU8 } from 'fflate';

export const THREEMF_MIME = 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml';

export function packageFiles(
  modelXml: string,
  thumbnail: Uint8Array | undefined,
  projectSettingsJson: string | undefined,
  modelSettingsXml?: string
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
  if (modelSettingsXml) {
    // BambuStudio/OrcaSlicer read per-object settings (including the base
    // `extruder` assignment) from this sidecar. It's what colors a whole
    // uniform secondary object — the lid — by filament; `paint_color` alone
    // leaves it on the default extruder (body). See `buildModelSettingsConfig`.
    files['Metadata/model_settings.config'] = strToU8(modelSettingsXml);
  }
  if (projectSettingsJson) {
    // Both OrcaSlicer and BambuStudio read this via
    // `_extract_project_config_from_archive` and apply `filament_colour` to
    // their AMS slots, so the user opens the file with the bin's zone
    // palette already pre-filled. BambuStudio additionally gates the loader
    // on an `Application=BambuStudio-X.Y.Z` metadata claim — see
    // BAMBU_COMPAT_APPLICATION in threemfColor — without which Bambu silently
    // skips the sidecar and shows a "not from Bambu Lab" dialog instead.
    files['Metadata/project_settings.config'] = strToU8(projectSettingsJson);
  }
  return zipSync(files, { level: 6 });
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

/**
 * fflate's browser WASM path can return a Uint8Array backed by a larger
 * pre-allocated ArrayBuffer. Slicing to the view's range avoids trailing
 * garbage and produces an ArrayBuffer (not ArrayBufferLike) which satisfies
 * the TS6 BlobPart constraint.
 */
export function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}
