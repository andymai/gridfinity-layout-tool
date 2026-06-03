/**
 * Hardware-spec size presets for insert-style cutouts. Values are nominal
 * (the clearance field adds the fit allowance), so a user can pick "1/4" hex"
 * and trust the number matches their bit's spec sheet.
 *
 * Labels are deliberately language-neutral (numbers + unit symbols), so they
 * read identically across locales.
 */

export interface CutoutSizePreset {
  /** Stable option id. */
  readonly id: string;
  /** Spec label, e.g. `1/4" hex (6.35mm)`. */
  readonly label: string;
  /** Nominal size in mm — across-flats for polygons, diameter for circles. */
  readonly mm: number;
}

/** Across-flats presets for hex / polygon cutouts (driver bits + Allen keys). */
export const HEX_ACROSS_FLATS_PRESETS: readonly CutoutSizePreset[] = [
  { id: 'hex-1-4', label: '1/4" hex bit (6.35mm)', mm: 6.35 },
  { id: 'allen-1-5', label: 'Allen 1.5mm', mm: 1.5 },
  { id: 'allen-2', label: 'Allen 2mm', mm: 2 },
  { id: 'allen-2-5', label: 'Allen 2.5mm', mm: 2.5 },
  { id: 'allen-3', label: 'Allen 3mm', mm: 3 },
  { id: 'allen-4', label: 'Allen 4mm', mm: 4 },
  { id: 'allen-5', label: 'Allen 5mm', mm: 5 },
  { id: 'allen-6', label: 'Allen 6mm', mm: 6 },
  { id: 'allen-8', label: 'Allen 8mm', mm: 8 },
  { id: 'allen-10', label: 'Allen 10mm', mm: 10 },
];

/**
 * Diameter presets for circle cutouts. Covers the three socket drive sizes
 * (the square post / through-hole) plus a ladder of round diameters useful for
 * socket-body and round-stock organizers.
 */
export const CIRCLE_DIAMETER_PRESETS: readonly CutoutSizePreset[] = [
  { id: 'drive-1-4', label: '1/4" drive (6.35mm)', mm: 6.35 },
  { id: 'drive-3-8', label: '3/8" drive (9.53mm)', mm: 9.53 },
  { id: 'drive-1-2', label: '1/2" drive (12.7mm)', mm: 12.7 },
  { id: 'dia-10', label: '10mm', mm: 10 },
  { id: 'dia-12', label: '12mm', mm: 12 },
  { id: 'dia-14', label: '14mm', mm: 14 },
  { id: 'dia-16', label: '16mm', mm: 16 },
  { id: 'dia-18', label: '18mm', mm: 18 },
  { id: 'dia-20', label: '20mm', mm: 20 },
  { id: 'dia-24', label: '24mm', mm: 24 },
];
