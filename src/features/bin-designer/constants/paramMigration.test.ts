import { describe, it, expect } from 'vitest';
import { migrateWalls } from './paramMigration';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from './defaults';

const defaults = DEFAULT_BIN_PARAMS.walls;
const migrate = (raw: Parameters<typeof migrateWalls>[0]): ReturnType<typeof migrateWalls> =>
  migrateWalls(raw, defaults, DISABLED_WALL_CUTOUT);

describe('migrateWalls', () => {
  it('returns the defaults when input is undefined', () => {
    expect(migrate(undefined)).toBe(defaults);
  });

  it('expands legacy numeric sides into WallCutout objects', () => {
    const result = migrate({ front: 12, back: 0 });
    expect(result.front.enabled).toBe(true);
    expect(result.front.width).toBe(12);
    expect(result.front.depth).toBe(100);
    expect(result.back.enabled).toBe(false);
    expect(result.back.width).toBe(0);
    expect(result.enabled).toBe(true);
  });

  it('leaves all sides disabled when every legacy number is zero', () => {
    const result = migrate({ front: 0, back: 0, left: 0, right: 0 });
    expect(result.enabled).toBe(false);
  });

  it('merges current object-form sides with defaults', () => {
    const result = migrate({
      enabled: true,
      front: { enabled: true, width: 20, depth: 30 },
    });
    expect(result.enabled).toBe(true);
    expect(result.front.width).toBe(20);
    expect(result.front.depth).toBe(30);
    // Unspecified sides fall back to defaults
    expect(result.back).toEqual(defaults.back);
  });

  it('backfills enabled from non-zero dims when the field is absent', () => {
    const result = migrate({ front: { width: 15, depth: 40 } });
    expect(result.front.enabled).toBe(true);
  });

  it('rejects an invalid shape and falls back to the default', () => {
    const result = migrate({ shape: 'bogus' as never });
    expect(result.shape).toBe(defaults.shape);
  });
});
