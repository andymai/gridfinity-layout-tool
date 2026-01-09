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
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { RightPanel } from '../components/RightPanel';
import { Staging } from '../components/Staging';
import { useLayoutStore } from '../store/layout';
import { useUIStore } from '../store/ui';
import { createDefaultLayout } from '../constants';

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
  useUIStore.setState({
    activeLayerId: defaultLayout.layers[0].id,
    selectedBinIds: [],
    activeCategoryId: defaultLayout.categories[0].id,
    zoom: 1,
    showOtherLayers: true,
    showLabels: true,
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    interaction: null,
    dropTarget: null,
    paintSize: null,
    activeMobilePanel: null,
    contextMenu: null,
    showIsometricPreview: true,
    isometricRotation: 0,
    hideLayersAbove: false,
    dimInactiveLayers: true,
    isPreviewExpanded: false,
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
        'label': { enabled: true },
        'link-name': { enabled: true },
      },
    });

    // Log violations for debugging
    if (results.violations.length > 0) {
      console.warn('Header violations:', JSON.stringify(results.violations, null, 2));
    }

    expect(results).toHaveNoViolations();
  });

  it('Sidebar has no critical accessibility violations', async () => {
    const { container } = render(<Sidebar />);
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
        'button-name': { enabled: true },
        'image-alt': { enabled: true },
        'label': { enabled: true },
        'link-name': { enabled: true },
      },
    });

    if (results.violations.length > 0) {
      console.warn('Sidebar violations:', JSON.stringify(results.violations, null, 2));
    }

    expect(results).toHaveNoViolations();
  });

  it('RightPanel has no critical accessibility violations', async () => {
    const { container } = render(<RightPanel />);
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
        'button-name': { enabled: true },
        'image-alt': { enabled: true },
        'label': { enabled: true },
        'link-name': { enabled: true },
      },
    });

    if (results.violations.length > 0) {
      console.warn('RightPanel violations:', JSON.stringify(results.violations, null, 2));
    }

    expect(results).toHaveNoViolations();
  });

  it('Staging has no critical accessibility violations', async () => {
    const { container } = render(<Staging />);
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
        'button-name': { enabled: true },
        'image-alt': { enabled: true },
        'label': { enabled: true },
        'link-name': { enabled: true },
      },
    });

    if (results.violations.length > 0) {
      console.warn('Staging violations:', JSON.stringify(results.violations, null, 2));
    }

    expect(results).toHaveNoViolations();
  });
});
