import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LabsDrawer } from './LabsDrawer';
import { resetAllStores } from '@/test/testUtils';
import { useLabsStore } from '@/core/store';
import { getFeature } from '@/core/labs';

// Real store, real FeatureCard, real Switch — this exercises the Zustand
// subscription path that the heavily-mocked LabsDrawer.test.tsx cannot.
// Only the unrelated EngineSelector child is stubbed out.
vi.mock('../EngineSelector', () => ({
  EngineSelector: () => null,
  KERNEL_FEATURE_IDS: ['brepkit_kernel'] as const,
}));

// A real, low-risk, toggleable experimental feature. Resolve it up front and
// fail loudly if it ever disappears from the labs config, rather than letting
// an empty name silently break the `getByText` lookup below.
const FEATURE_ID = 'show_generation_perf';
const FEATURE = getFeature(FEATURE_ID);
if (!FEATURE) {
  throw new Error(`Labs feature "${FEATURE_ID}" no longer exists; update this regression test`);
}
const FEATURE_NAME = FEATURE.name;

describe('LabsDrawer toggle reactivity (regression)', () => {
  beforeEach(() => {
    resetAllStores();
    useLabsStore.setState({ isDrawerOpen: true });
  });

  it('visually flips the switch when a feature is toggled', () => {
    render(<LabsDrawer />);

    const article = screen.getByText(FEATURE_NAME).closest('article');
    expect(article).not.toBeNull();
    const toggle = within(article as HTMLElement).getByRole('switch');

    // Starts disabled.
    expect(toggle).not.toBeChecked();

    // Clicking flips the store value...
    fireEvent.click(toggle);
    expect(useLabsStore.getState().isFeatureEnabled(FEATURE_ID)).toBe(true);

    // ...and the switch must visually reflect the new state.
    expect(toggle).toBeChecked();
  });
});
