import { describe, it, expect, vi, onTestFinished } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { BaseplatePage } from './BaseplatePage';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import type { BaseplatePiece, BaseplateTiling } from '../../types/tiling';
import type { ShapeEditorSlot } from '../../types/shapeEditor';

// Mock i18n
vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

// Mock responsive hook
const mocks = vi.hoisted(() => ({
  responsive: { isDesktop: true, isLandscape: false, isMobile: false, isTablet: false },
}));
vi.mock('@/shared/hooks/useResponsive', () => ({
  useResponsive: () => mocks.responsive,
}));

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: (selector: (state: unknown) => unknown) => {
    const state = {
      layout: {
        drawer: { width: 4, depth: 6 },
        gridUnitMm: 42,
        printBedSize: 256,
        baseplateParams: { ...DEFAULT_BASEPLATE_PARAMS },
      },
    };
    if (typeof selector === 'function') return selector(state);
    return state;
  },
}));

// Mock generation and export hooks
vi.mock('../../hooks/useBaseplateGeneration', () => ({
  useBaseplateGeneration: vi.fn(),
}));

// Library init/autosave have their own dedicated tests; stub them here so this
// UI test doesn't drive IndexedDB or the layout store's getState.
vi.mock('../../hooks/useBaseplateLibraryInit', () => ({
  useBaseplateLibraryInit: vi.fn(),
}));

vi.mock('../../hooks/useBaseplateAutoSave', () => ({
  useBaseplateAutoSave: vi.fn(),
}));

vi.mock('../../hooks/useBaseplateExport', () => ({
  useBaseplateExport: () => ({
    isExporting: false,
    canExport: true,
    downloadBaseplate: vi.fn(),
  }),
}));

// Mock child components to avoid Three.js
vi.mock('../BaseplatePanel/BaseplatePanel', () => ({
  BaseplatePanel: ({ shapeEditor: ShapeEditor }: { shapeEditor?: ShapeEditorSlot }) => (
    <div data-testid="panel">{ShapeEditor !== undefined && <ShapeEditor />}</div>
  ),
}));

vi.mock('../BaseplatePreview/BaseplatePreview', () => ({
  BaseplatePreview: () => <div data-testid="preview">Preview</div>,
}));

vi.mock('@/shared/hooks/useBaseplateRouting', () => ({
  useBaseplateRouting: () => ({
    isStandalone: false,
    isBaseplateRoute: true,
    layoutIdFromUrl: null,
    navigateToBaseplate: vi.fn(),
  }),
}));

vi.mock('@/shared/components/ToolSwitcher', () => ({
  ToolSwitcher: (props: Record<string, unknown>) => (
    <div
      data-testid="tool-switcher"
      data-compact={props.compact}
      data-icon-only={props.iconOnly}
      data-labels-from-xl={props.labelsFromXl}
    />
  ),
}));

// Mock HeaderSupportLinks to avoid deep dependency tree (LanguageSelector, analytics, etc.)
vi.mock('@/shared/components/HeaderSupportLinks', () => ({
  HeaderSupportLinks: (props: { compact?: boolean; leadingItems?: ReactNode }) => (
    <div data-testid="header-support-links" data-compact={String(props.compact ?? false)}>
      {props.leadingItems && <div data-testid="header-menu-leading">{props.leadingItems}</div>}
    </div>
  ),
}));

vi.mock('../BaseplateSelector', () => ({
  BaseplateSelector: () => <div data-testid="baseplate-selector" />,
  BaseplateMenuItems: () => <div data-testid="baseplate-menu-items" />,
}));

describe('BaseplatePage', () => {
  beforeEach(() => {
    mocks.responsive = { isDesktop: true, isLandscape: false, isMobile: false, isTablet: false };
  });

  it('always renders ToolSwitcher in header', () => {
    render(<BaseplatePage />);
    expect(screen.getByTestId('tool-switcher')).toBeInTheDocument();
  });

  it('renders export button', () => {
    render(<BaseplatePage />);
    expect(screen.getByLabelText('common.export')).toBeInTheDocument();
  });

  it('undoes and redoes from the header, and disables a button with no step to take', () => {
    const original = useHistoryStore.getState();
    onTestFinished(() => useHistoryStore.setState(original, true));
    const undo = vi.fn();
    const redo = vi.fn();
    useHistoryStore.setState({ canUndo: true, canRedo: false, undo, redo });
    render(<BaseplatePage />);

    fireEvent.click(screen.getByRole('button', { name: 'header.undo' }));
    expect(undo).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'header.redo' })).toBeDisabled();

    act(() => useHistoryStore.setState({ canUndo: false, canRedo: true }));
    expect(screen.getByRole('button', { name: 'header.undo' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'header.redo' }));
    expect(redo).toHaveBeenCalledOnce();
  });

  // The page lays the panel out four ways, and each one has to keep the
  // shape editor the shell hands in.
  it.each([
    ['desktop', { isDesktop: true, isLandscape: false, isMobile: false, isTablet: false }],
    ['landscape', { isDesktop: false, isLandscape: true, isMobile: false, isTablet: true }],
    ['tablet', { isDesktop: false, isLandscape: false, isMobile: false, isTablet: true }],
    ['phone', { isDesktop: false, isLandscape: false, isMobile: true, isTablet: false }],
  ])('passes the shape editor to the panel on %s', (_width, responsive) => {
    mocks.responsive = responsive;
    render(<BaseplatePage shapeEditor={() => <div data-testid="shape-editor" />} />);
    expect(screen.getByTestId('panel')).toContainElement(screen.getByTestId('shape-editor'));
  });

  it('renders panel and preview in desktop mode', () => {
    render(<BaseplatePage />);
    expect(screen.getByTestId('panel')).toBeInTheDocument();
    expect(screen.getByTestId('preview')).toBeInTheDocument();
  });

  it('renders the full header support links on desktop', () => {
    render(<BaseplatePage />);
    expect(screen.getByTestId('header-support-links')).toHaveAttribute('data-compact', 'false');
  });

  it.each([
    ['phone', { isDesktop: false, isLandscape: false, isMobile: true, isTablet: false }],
    ['tablet', { isDesktop: false, isLandscape: false, isMobile: false, isTablet: true }],
  ])('folds the support links, Settings included, into a menu on a %s', (_width, responsive) => {
    mocks.responsive = responsive;
    render(<BaseplatePage />);
    expect(screen.getByTestId('header-support-links')).toHaveAttribute('data-compact', 'true');
  });

  it.each([
    ['desktop', { isDesktop: true, isLandscape: false, isMobile: false, isTablet: false }],
    ['tablet', { isDesktop: false, isLandscape: false, isMobile: false, isTablet: true }],
  ])('shows the plate name and its buttons in the header on %s', (_width, responsive) => {
    mocks.responsive = responsive;
    render(<BaseplatePage />);
    expect(screen.getByTestId('baseplate-selector')).toBeInTheDocument();
    expect(screen.queryByTestId('baseplate-menu-items')).not.toBeInTheDocument();
  });

  it('folds the list and New baseplate into the header menu on a phone', () => {
    mocks.responsive = { isDesktop: false, isLandscape: false, isMobile: true, isTablet: false };
    render(<BaseplatePage />);
    expect(screen.queryByTestId('baseplate-selector')).not.toBeInTheDocument();
    expect(screen.getByTestId('header-menu-leading')).toContainElement(
      screen.getByTestId('baseplate-menu-items')
    );
  });

  it('shows tool labels only from xl on desktop, like the other headers', () => {
    render(<BaseplatePage />);
    expect(screen.getByTestId('tool-switcher')).toHaveAttribute('data-labels-from-xl', 'true');
  });

  it('passes responsive props to ToolSwitcher on mobile', () => {
    mocks.responsive = { isDesktop: false, isLandscape: false, isMobile: true, isTablet: false };
    render(<BaseplatePage />);
    const switcher = screen.getByTestId('tool-switcher');
    expect(switcher).toHaveAttribute('data-compact', 'true');
    expect(switcher).toHaveAttribute('data-icon-only', 'true');
  });

  it('passes responsive props to ToolSwitcher on tablet', () => {
    mocks.responsive = { isDesktop: false, isLandscape: false, isMobile: false, isTablet: true };
    render(<BaseplatePage />);
    const switcher = screen.getByTestId('tool-switcher');
    expect(switcher).toHaveAttribute('data-compact', 'false');
    expect(switcher).toHaveAttribute('data-icon-only', 'true');
  });

  it('gives the build-plate loads their own sentence in the split banner', () => {
    const tiling: BaseplateTiling = {
      isSplit: true,
      pieces: Array.from({ length: 4 }, () => ({}) as BaseplatePiece),
      margins: [],
      cols: 2,
      rows: 2,
      colSizes: [5, 5],
      rowSizes: [4, 4],
      totalWidthUnits: 10,
      totalDepthUnits: 8,
      stackCount: 1,
      stackSeparatorThickness: 0,
      bedLoads: 3,
      paddingReductionHint: null,
      isCustomSplit: false,
      bedOverages: [],
    };
    useBaseplatePageStore.setState({ tiling, exportDialogOpen: true });

    try {
      render(<BaseplatePage />);
      expect(
        screen.getByText('baseplate.export.splitBanner baseplate.export.bedLoads_other')
      ).toBeInTheDocument();
    } finally {
      useBaseplatePageStore.setState({ tiling: null, exportDialogOpen: false });
    }
  });
});
