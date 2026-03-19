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
vi.mock('@/hooks/useBaseplateRouting', () => ({
  useBaseplateRouting: () => ({
    isStandalone: false,
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

// Mock HeaderSupportLinks to avoid deep dependency tree (LanguageSelector, analytics, etc.)
vi.mock('@/shared/components/HeaderSupportLinks', () => ({
  HeaderSupportLinks: () => <div data-testid="header-support-links" />,
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
    mockResponsive = { isDesktop: true, isLandscape: false, isMobile: false, isTablet: false };
  });

  it('always renders ToolSwitcher in header', () => {
    render(<BaseplatePage />);
    expect(screen.getByTestId('tool-switcher')).toBeInTheDocument();
  });

  it('renders export button', () => {
    render(<BaseplatePage />);
    expect(screen.getByLabelText('common.export')).toBeInTheDocument();
  });

  it('renders panel and preview in desktop mode', () => {
    render(<BaseplatePage />);
    expect(screen.getByTestId('panel')).toBeInTheDocument();
    expect(screen.getByTestId('preview')).toBeInTheDocument();
  });

  it('renders header support links on desktop', () => {
    render(<BaseplatePage />);
    expect(screen.getByTestId('header-support-links')).toBeInTheDocument();
  });

  it('does not render header support links on mobile', () => {
    mockResponsive = { isDesktop: false, isLandscape: false, isMobile: true, isTablet: false };
    render(<BaseplatePage />);
    expect(screen.queryByTestId('header-support-links')).not.toBeInTheDocument();
  });

  it('passes responsive props to ToolSwitcher on mobile', () => {
    mockResponsive = { isDesktop: false, isLandscape: false, isMobile: true, isTablet: false };
    render(<BaseplatePage />);
    const switcher = screen.getByTestId('tool-switcher');
    expect(switcher).toHaveAttribute('data-compact', 'true');
    expect(switcher).toHaveAttribute('data-icon-only', 'true');
  });

  it('passes responsive props to ToolSwitcher on tablet', () => {
    mockResponsive = { isDesktop: false, isLandscape: false, isMobile: false, isTablet: true };
    render(<BaseplatePage />);
    const switcher = screen.getByTestId('tool-switcher');
    expect(switcher).toHaveAttribute('data-compact', 'false');
    expect(switcher).toHaveAttribute('data-icon-only', 'true');
  });
});
