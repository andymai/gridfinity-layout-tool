import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BaseplatePage } from './BaseplatePage';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';

// Mock i18n
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

// Mock responsive hook
let mockResponsive = { isDesktop: true, isLandscape: false, isMobile: false };
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

// Mock design-system components
vi.mock('@/design-system/Menu', () => ({
  Menu: {
    Root: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
      open ? <div data-testid="menu">{children}</div> : null,
    Item: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
      <button onClick={onClick}>{children}</button>
    ),
    Divider: () => <hr />,
  },
}));

describe('BaseplatePage', () => {
  it('renders header with title and back button', () => {
    render(<BaseplatePage />);
    expect(screen.getByText('baseplate.pageTitle')).toBeInTheDocument();
    expect(screen.getByLabelText('baseplate.backToLayout')).toBeInTheDocument();
  });

  it('renders export button', () => {
    render(<BaseplatePage />);
    expect(screen.getByLabelText('common.export')).toBeInTheDocument();
  });

  it('renders panel and preview in desktop mode', () => {
    mockResponsive = { isDesktop: true, isLandscape: false, isMobile: false };
    render(<BaseplatePage />);
    expect(screen.getByTestId('panel')).toBeInTheDocument();
    expect(screen.getByTestId('preview')).toBeInTheDocument();
  });

  it('exports a component function', () => {
    expect(typeof BaseplatePage).toBe('function');
  });
});
