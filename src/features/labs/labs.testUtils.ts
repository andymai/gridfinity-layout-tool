import { vi } from 'vitest';
import { ok } from '@/core/result';
import type { useLabsStore } from '@/core/store';
import type { FeatureFlag } from '@/core/labs';

type LabsStore = ReturnType<typeof useLabsStore.getState>;

/** A complete `FeatureFlag`, so fixtures don't have to restate the required fields. */
export function makeFeatureFlag(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
  return {
    id: 'test-feature',
    name: 'Test Feature',
    description: 'A test feature',
    status: 'experimental',
    risk: 'low',
    addedAt: '2026-01-01',
    requiresRefresh: false,
    ...overrides,
  };
}

/**
 * A complete `LabsState` double.
 *
 * Component tests only care about two or three members, but mocking
 * `useLabsStore` with a partial object types the whole store as that partial —
 * so a component reaching for anything else gets `undefined` at runtime with no
 * warning. Spreading a full default keeps the mock honest and lets a test
 * override only what it exercises.
 */
export function makeLabsState(overrides: Partial<LabsStore> = {}): LabsStore {
  return {
    preferences: { enabledFeatures: {}, lastModified: '2026-01-01T00:00:00.000Z', version: 1 },
    isDrawerOpen: false,
    openDrawer: vi.fn(),
    closeDrawer: vi.fn(),
    toggleDrawer: vi.fn(),
    toggleFeature: vi.fn(() => ok(undefined)),
    enableFeature: vi.fn(() => ok(undefined)),
    disableFeature: vi.fn(() => ok(undefined)),
    isFeatureEnabled: vi.fn(() => false),
    getEnabledCount: vi.fn(() => 0),
    syncFromStorage: vi.fn(),
    ...overrides,
  };
}
