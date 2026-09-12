import { sanitizeFileName } from '@/features/bin-designer/utils/fileNaming';

const FALLBACK = 'gridfinity-cutouts';

/** Download name for an exported cutout selection, prefixed by the design name. */
export function cutoutSvgFileName(designName?: string): string {
  const sanitized = sanitizeFileName(designName ?? '');
  const usable = sanitized && !/^_+$/.test(sanitized) && sanitized !== 'Untitled Bin';
  return `${usable ? `${sanitized}-cutouts` : FALLBACK}.svg`;
}
