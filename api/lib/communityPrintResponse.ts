import type { CommunityPrintRecord } from './communityPrintStore.js';

export interface PrintResponse {
  id: string;
  designId: string;
  authorPublicId: string;
  authorName: string;
  photos: string[];
  photoThumbs: string[];
  /** Every field omitted rather than nulled when unreported, so a client that
      reads `settings.nozzleMm` gets `undefined` and cannot format a 0. */
  settings: {
    material?: string;
    nozzleMm?: number;
    layerHeightMm?: number;
    printMinutes?: number;
    filamentGrams?: number;
    printer?: string;
    printerOther?: string;
  };
  fitVerdict: string;
  note: string;
  createdAt: number;
  updatedAt: number;
  status: string;
}

export function toPrintResponse(record: CommunityPrintRecord): PrintResponse {
  return {
    id: `${record.designId}:${record.authorPublicId}`,
    designId: record.designId,
    authorPublicId: record.authorPublicId,
    authorName: record.authorName,
    photos: record.photos,
    photoThumbs: record.photoThumbs,
    settings: {
      ...(record.material !== null && { material: record.material }),
      ...(record.nozzleMm !== null && { nozzleMm: record.nozzleMm }),
      ...(record.layerHeightMm !== null && { layerHeightMm: record.layerHeightMm }),
      ...(record.printMinutes !== null && { printMinutes: record.printMinutes }),
      ...(record.filamentGrams !== null && { filamentGrams: record.filamentGrams }),
      ...(record.printer !== null && { printer: record.printer }),
      ...(record.printerOther !== '' && { printerOther: record.printerOther }),
    },
    fitVerdict: record.fitVerdict,
    note: record.note,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    status: record.status,
  };
}
