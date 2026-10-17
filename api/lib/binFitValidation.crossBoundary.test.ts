/**
 * The server's per-bin fit bounds are hand-copied from the client, since api/
 * cannot import src/ at runtime. A client ceiling raised without this file
 * makes every synced or shared bin past the old one silently lose the field.
 */
import { describe, expect, it } from 'vitest';

import {
  BIN_OVERHANG_MM_MAX,
  TAPER_BAND_MM_MAX,
  TAPER_FLARE_MM_MAX,
  TAPER_PROFILES,
} from './binFitValidation.js';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants/gridfinity';
import type { WallTaperProfile } from '@/core/types/overhang';

describe('bin fit bounds mirror the client', () => {
  it('overhang ceiling', () => {
    expect(BIN_OVERHANG_MM_MAX).toBe(DESIGNER_CONSTRAINTS.MAX_OVERHANG);
    expect(DESIGNER_CONSTRAINTS.MIN_OVERHANG).toBe(0);
  });

  it('taper ceilings', () => {
    expect(TAPER_FLARE_MM_MAX).toBe(DESIGNER_CONSTRAINTS.MAX_TAPER);
    expect(TAPER_BAND_MM_MAX).toBe(DESIGNER_CONSTRAINTS.MAX_TAPER_BAND);
    expect(DESIGNER_CONSTRAINTS.MIN_TAPER).toBe(0);
    expect(DESIGNER_CONSTRAINTS.MIN_TAPER_BAND).toBe(0);
  });

  it('taper profiles', () => {
    const client: Record<WallTaperProfile, true> = { chamfer: true, fillet: true };
    expect([...TAPER_PROFILES].sort()).toEqual(Object.keys(client).sort());
  });
});
