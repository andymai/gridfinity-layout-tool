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
import { Header } from '@/shell/Header';
import { Sidebar } from '@/shell/Sidebar';
import { RightPanel } from '@/shell/RightPanel';
import { Staging } from '@/features/staging/components/Staging';
import { HelpModal } from '@/shell/Modals/HelpModal';
import { ImportModal } from '@/shell/Modals/ImportModal';
import { CommandPalette } from '@/features/command-palette';
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

// jsdom does not implement scrollIntoView, which cmdk (command palette) calls
// on mount when a list item becomes active. Shim it only when absent so a real
// implementation (future jsdom, or another test) is never clobbered.
beforeEach(() => {
  if (typeof HTMLElement.prototype.scrollIntoView !== 'function') {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

// Critical axe rules — the single source of truth for every surface below.
// Kept intentionally narrow so the gate doesn't retroactively fail on
// pre-existing debt from rules we haven't remediated yet.
const CRITICAL_RULES = {
  'color-contrast': { enabled: true },
  'button-name': { enabled: true },
  'image-alt': { enabled: true },
  label: { enabled: true },
  'link-name': { enabled: true },
} as const;

async function expectNoCriticalViolations(container: HTMLElement, label: string) {
  const results = await axe(container, { rules: CRITICAL_RULES });
  if (results.violations.length > 0) {
    console.warn(`${label} violations:`, JSON.stringify(results.violations, null, 2));
  }
  expect(results).toHaveNoViolations();
}

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
    const { container } = render(<Header saveStatus="idle" />);
    await expectNoCriticalViolations(container, 'Header');
  }, 15_000);

  it('Sidebar has no critical accessibility violations', async () => {
    const { container } = render(<Sidebar />);
    const results = await axe(container, { rules: CRITICAL_RULES });

    // Layer rows intentionally nest interactive controls (rename span, height
    // steppers) inside a selectable container — accepted UX trade-off.
    // Filter out only those known violations so the rule stays enforced elsewhere.
    const filtered = {
      ...results,
      violations: results.violations.filter(
        (v) =>
          !(v.id === 'nested-interactive' && v.nodes.every((n) => n.html.includes('data-layer-id')))
      ),
    };

    if (filtered.violations.length > 0) {
      console.warn('Sidebar violations:', JSON.stringify(filtered.violations, null, 2));
    }

    expect(filtered).toHaveNoViolations();
  }, 15_000);

  it('RightPanel has no critical accessibility violations', async () => {
    const { container } = render(<RightPanel />);
    await expectNoCriticalViolations(container, 'RightPanel');
  }, 15_000);

  it('Staging has no critical accessibility violations', async () => {
    const { container } = render(<Staging />);
    await expectNoCriticalViolations(container, 'Staging');
  }, 15_000);
});

// Overlay surfaces (modals + command palette) trap focus and present dense
// interactive content, so they are prime places for missing labels / unnamed
// controls. Same critical rule set as the shell surfaces above.
describe('Accessibility - Overlays', () => {
  it('HelpModal (open) has no critical accessibility violations', async () => {
    const { container } = render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    await expectNoCriticalViolations(container, 'HelpModal');
  }, 15_000);

  it('ImportModal (open) has no critical accessibility violations', async () => {
    const { container } = render(
      <ImportModal isOpen={true} onClose={vi.fn()} onImport={vi.fn()} />
    );
    await expectNoCriticalViolations(container, 'ImportModal');
  }, 15_000);

  it('CommandPalette (open) has no critical accessibility violations', async () => {
    const { container } = render(<CommandPalette open={true} onOpenChange={vi.fn()} />);
    await expectNoCriticalViolations(container, 'CommandPalette');
  }, 15_000);
});
