import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeMatchers } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';

// Extend vitest matchers with axe matchers
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Assertion<T> extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { RightPanel } from '@/components/RightPanel';
import { Staging } from '@/features/staging/components/Staging';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useViewStore } from '@/core/store/view';
import { useInteractionStore } from '@/core/store/interaction';
import { useMobileStore } from '@/core/store/mobile';
import { createDefaultLayout } from '@/core/constants';

// Extend expect with axe matchers
expect.extend(matchers);

// Mock matchMedia for useResponsive hook
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Reset stores before each test
beforeEach(() => {
  const defaultLayout = createDefaultLayout();
  useLayoutStore.setState({ layout: defaultLayout });
  useSelectionStore.setState({
    activeLayerId: defaultLayout.layers[0].id,
    selectedBinIds: [],
    activeCategoryId: defaultLayout.categories[0].id,
  });
  useViewStore.setState({
    zoom: 1,
    showOtherLayers: true,
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    contextMenu: null,
  });
  useInteractionStore.setState({
    interaction: null,
    dropTarget: null,
    paintSize: null,
    showIsometricPreview: true,
    isometricRotation: 0,
    layerViewMode: 'focus',
    isPreviewExpanded: false,
  });
  useMobileStore.setState({
    activeMobilePanel: null,
  });
});

describe('Accessibility - Critical Issues', () => {
  it('Header has no critical accessibility violations', async () => {
    const { container } = render(<Header onHelpClick={() => {}} />);
    const results = await axe(container, {
      rules: {
        // Focus on critical issues
        'color-contrast': { enabled: true },
        'button-name': { enabled: true },
        'image-alt': { enabled: true },
        label: { enabled: true },
        'link-name': { enabled: true },
      },
    });

    // Log violations for debugging
    if (results.violations.length > 0) {
      console.warn('Header violations:', JSON.stringify(results.violations, null, 2));
    }

    expect(results).toHaveNoViolations();
  }, 15_000);

  it('Sidebar has no critical accessibility violations', async () => {
    const { container } = render(<Sidebar />);
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
        'button-name': { enabled: true },
        'image-alt': { enabled: true },
        label: { enabled: true },
        'link-name': { enabled: true },
      },
    });

    if (results.violations.length > 0) {
      console.warn('Sidebar violations:', JSON.stringify(results.violations, null, 2));
    }

    expect(results).toHaveNoViolations();
  }, 15_000);

  it('RightPanel has no critical accessibility violations', async () => {
    const { container } = render(<RightPanel />);
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
        'button-name': { enabled: true },
        'image-alt': { enabled: true },
        label: { enabled: true },
        'link-name': { enabled: true },
      },
    });

    if (results.violations.length > 0) {
      console.warn('RightPanel violations:', JSON.stringify(results.violations, null, 2));
    }

    expect(results).toHaveNoViolations();
  }, 15_000);

  it('Staging has no critical accessibility violations', async () => {
    const { container } = render(<Staging />);
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
        'button-name': { enabled: true },
        'image-alt': { enabled: true },
        label: { enabled: true },
        'link-name': { enabled: true },
      },
    });

    if (results.violations.length > 0) {
      console.warn('Staging violations:', JSON.stringify(results.violations, null, 2));
    }

    expect(results).toHaveNoViolations();
  }, 15_000);
});
