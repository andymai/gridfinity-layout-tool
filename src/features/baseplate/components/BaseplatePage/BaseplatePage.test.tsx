import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BaseplatePage } from './BaseplatePage';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';

// Mock i18n
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

// Mock responsive hook
let mockResponsive = { isDesktop: true, isLandscape: false, isMobile: false, isTablet: false };
vi.mock('@/shared/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsive,
}));

// Mock layout store
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

vi.mock('../../hooks/useBaseplateExport', () => ({
  useBaseplateExport: () => ({
    isExporting: false,
    canExport: true,
    downloadBaseplate: vi.fn(),
  }),
}));

// Mock child components to avoid Three.js
vi.mock('../BaseplatePanel/BaseplatePanel', () => ({
  BaseplatePanel: () => <div data-testid="panel">Panel</div>,
}));

vi.mock('../BaseplatePreview/BaseplatePreview', () => ({
  BaseplatePreview: () => <div data-testid="preview">Preview</div>,
}));

// Mock routing hook
let mockIsStandalone = false;
vi.mock('@/hooks/useBaseplateRouting', () => ({
  useBaseplateRouting: () => ({
    navigateBack: vi.fn(),
    isStandalone: mockIsStandalone,
    isBaseplateRoute: true,
    layoutIdFromUrl: null,
    navigateToBaseplate: vi.fn(),
  }),
}));

// Mock ToolSwitcher
vi.mock('@/shared/components/ToolSwitcher', () => ({
  ToolSwitcher: (props: Record<string, unknown>) => (
    <div data-testid="tool-switcher" data-compact={props.compact} data-icon-only={props.iconOnly} />
  ),
}));

// Mock slicer open hook
vi.mock('../../hooks/useBaseplateSlicerOpen', () => ({
  useBaseplateSlicerOpen: () => ({
    isOpening: false,
    openingSlicerId: null,
    openInSlicer: vi.fn(),
  }),
}));

describe('BaseplatePage', () => {
  beforeEach(() => {
    mockIsStandalone = false;
    mockResponsive = { isDesktop: true, isLandscape: false, isMobile: false, isTablet: false };
  });

  it('renders header with title and back button in planner mode', () => {
    render(<BaseplatePage />);
    expect(screen.getByText('baseplate.pageTitle')).toBeInTheDocument();
    expect(screen.getByLabelText('baseplate.backToLayout')).toBeInTheDocument();
    expect(screen.queryByTestId('tool-switcher')).not.toBeInTheDocument();
  });

  it('renders ToolSwitcher in standalone mode', () => {
    mockIsStandalone = true;
    render(<BaseplatePage />);
    expect(screen.getByTestId('tool-switcher')).toBeInTheDocument();
    expect(screen.queryByText('baseplate.pageTitle')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('baseplate.backToLayout')).not.toBeInTheDocument();
  });

  it('renders export button in planner mode', () => {
    render(<BaseplatePage />);
    expect(screen.getByLabelText('common.export')).toBeInTheDocument();
  });

  it('renders export button in standalone mode', () => {
    mockIsStandalone = true;
    render(<BaseplatePage />);
    expect(screen.getByLabelText('common.export')).toBeInTheDocument();
  });

  it('renders panel and preview in desktop mode', () => {
    render(<BaseplatePage />);
    expect(screen.getByTestId('panel')).toBeInTheDocument();
    expect(screen.getByTestId('preview')).toBeInTheDocument();
  });

  it('passes responsive props to ToolSwitcher on mobile', () => {
    mockIsStandalone = true;
    mockResponsive = { isDesktop: false, isLandscape: false, isMobile: true, isTablet: false };
    render(<BaseplatePage />);
    const switcher = screen.getByTestId('tool-switcher');
    expect(switcher).toHaveAttribute('data-compact', 'true');
    expect(switcher).toHaveAttribute('data-icon-only', 'true');
  });

  it('passes responsive props to ToolSwitcher on tablet', () => {
    mockIsStandalone = true;
    mockResponsive = { isDesktop: false, isLandscape: false, isMobile: false, isTablet: true };
    render(<BaseplatePage />);
    const switcher = screen.getByTestId('tool-switcher');
    expect(switcher).toHaveAttribute('data-compact', 'false');
    expect(switcher).toHaveAttribute('data-icon-only', 'true');
  });
});
