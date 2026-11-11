export interface ManifestScreenshot {
  /** File in public/screenshots/, written by `ONLY=manifest pnpm run gen:seo-images`. */
  file: string;
  width: number;
  height: number;
  formFactor: 'wide' | 'narrow';
  label: string;
}

const WIDE = { width: 1920, height: 1080, formFactor: 'wide' } as const;
const NARROW = { width: 780, height: 1688, formFactor: 'narrow' } as const;

export const MANIFEST_SCREENSHOTS: readonly ManifestScreenshot[] = [
  {
    ...WIDE,
    file: 'layout-wide.png',
    label: 'Layout editor with a kitchen drawer of labeled, color-coded bins',
  },
  {
    ...WIDE,
    file: 'designer-wide.png',
    label: 'Bin designer with a 3D preview of a multicolor organizer bin',
  },
  {
    ...WIDE,
    file: 'baseplate-wide.png',
    label: 'Baseplate generator with a 3D preview of a magnet baseplate',
  },
  { ...NARROW, file: 'layout-narrow.png', label: 'Layout editor on a phone' },
  { ...NARROW, file: 'designer-narrow.png', label: 'Bin designer on a phone' },
];

export function manifestScreenshotEntries(): Array<{
  src: string;
  sizes: string;
  type: string;
  form_factor: 'wide' | 'narrow';
  label: string;
}> {
  return MANIFEST_SCREENSHOTS.map((shot) => ({
    src: `/screenshots/${shot.file}`,
    sizes: `${shot.width}x${shot.height}`,
    type: 'image/png',
    form_factor: shot.formFactor,
    label: shot.label,
  }));
}
