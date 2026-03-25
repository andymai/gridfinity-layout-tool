import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__dual-kernel__/wasmInit';
import { buildHandleProfile } from './handleProfiles';

beforeAll(async () => {
  await initBrepjs();
});

describe('buildHandleProfile', () => {
  const defaultArgs = { width: 30, height: 15, cornerRadius: 5 };

  it('returns a valid Drawing for rectangle shape', () => {
    const profile = buildHandleProfile('rectangle', defaultArgs);
    expect(profile).not.toBeNull();
  });

  it('returns a valid Drawing for oval shape', () => {
    const profile = buildHandleProfile('oval', { ...defaultArgs, cornerRadius: 0 });
    expect(profile).not.toBeNull();
  });

  it('returns a valid Drawing for scoop shape', () => {
    const profile = buildHandleProfile('scoop', { ...defaultArgs, cornerRadius: 0 });
    expect(profile).not.toBeNull();
  });

  it('returns a valid Drawing for u-shape (open bottom)', () => {
    const profile = buildHandleProfile('u-shape', defaultArgs);
    expect(profile).not.toBeNull();
  });

  it('clamps corner radius to half of smallest dimension', () => {
    const profile = buildHandleProfile('rectangle', { width: 10, height: 10, cornerRadius: 20 });
    expect(profile).not.toBeNull();
  });

  it('returns null for zero-width', () => {
    const profile = buildHandleProfile('rectangle', { width: 0, height: 15, cornerRadius: 5 });
    expect(profile).toBeNull();
  });

  it('returns null for zero-height', () => {
    const profile = buildHandleProfile('rectangle', { width: 15, height: 0, cornerRadius: 5 });
    expect(profile).toBeNull();
  });

  it('rectangle with zero radius produces a sharp profile', () => {
    const profile = buildHandleProfile('rectangle', { width: 20, height: 10, cornerRadius: 0 });
    expect(profile).not.toBeNull();
  });
});
