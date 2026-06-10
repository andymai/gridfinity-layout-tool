import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileSettingsPanel } from './MobileSettingsPanel';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/core/store/settings', () => {
  const state = {
    settings: {
      analyticsEnabled: true,
      stlSearchSites: [],
      defaultDrawerWidth: 6,
      defaultDrawerDepth: 4,
      defaultDrawerHeight: 6,
      defaultLayerHeight: 6,
      defaultPrintBedSize: 256,
      defaultGridUnitMm: 42,
      printSettings: { nozzleSizeMm: 0.4 },
    },
    updateSetting: vi.fn(),
  };
  const useSettingsStore = (selector: (state: Record<string, unknown>) => unknown) =>
    selector(state);
  useSettingsStore.getState = () => state;
  return { useSettingsStore };
});

vi.mock('@/core/store/labs', () => {
  const state = {
    openDrawer: vi.fn(),
    preferences: { enabledFeatures: {} },
    isFeatureEnabled: () => false,
  };
  const useLabsStore = (selector: (state: Record<string, unknown>) => unknown) => selector(state);
  useLabsStore.getState = () => state;
  return { useLabsStore };
});

vi.mock('@/core/labs', () => ({
  getFeature: () => null,
}));

vi.mock('@/shared/hooks/useDrawerSettings', () => ({
  useDrawerSettings: () => ({
    drawer: { width: 6, depth: 4, height: 6 },
    widthStep: 1,
    depthStep: 1,
    realWorldDimensions: { width: 252, depth: 168, height: 42 },
    maxGridUnits: { width: 5, depth: 5 },
    gridUnitMm: 42,
    heightUnitMm: 7,
    printBedSize: 256,
    printBedDepth: 256,
    halfGridMode: false,
    settings: {
      stlSearchSites: [],
      defaultDrawerWidth: 6,
      defaultDrawerDepth: 4,
      defaultDrawerHeight: 6,
      defaultLayerHeight: 6,
      defaultPrintBedSize: 256,
      defaultGridUnitMm: 42,
    },
    activeLayerHeight: 6,
    fractionalEdges: { x: 'start', y: 'start' },
    hasFractionalWidth: false,
    hasFractionalDepth: false,
    handleDrawerWidthChange: vi.fn(),
    handleDrawerDepthChange: vi.fn(),
    handleDrawerHeightChange: vi.fn(),
    handleDrawerWidthInput: vi.fn(),
    handleDrawerDepthInput: vi.fn(),
    handleHalfBinToggle: vi.fn(),
    handleRemediate: vi.fn(),
    handleSaveDefaults: vi.fn(),
    handleFractionalEdgeChange: vi.fn(),
    setGridUnitMm: vi.fn(),
    setHeightUnitMm: vi.fn(),
    setPrintBedSize: vi.fn(),
    toggleSTLSite: vi.fn(),
    showSaveDefaultsConfirm: false,
    setShowSaveDefaultsConfirm: vi.fn(),
    showHalfBinBlockedModal: false,
    setShowHalfBinBlockedModal: vi.fn(),
    halfBinViolation: null,
  }),
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
  optInAnalytics: vi.fn(),
  optOutAnalytics: vi.fn(),
}));

describe('MobileSettingsPanel', () => {
  it('renders the GitHub link in legal section', () => {
    render(<MobileSettingsPanel />);
    const githubLink = screen.getByText('sidebar.github');
    expect(githubLink.closest('a')).toHaveAttribute(
      'href',
      'https://github.com/andymai/gridfinity-layout-tool'
    );
  });

  it('renders privacy and terms links', () => {
    render(<MobileSettingsPanel />);
    expect(screen.getByText('settings.privacyPolicy')).toBeInTheDocument();
    expect(screen.getByText('settings.termsOfService')).toBeInTheDocument();
  });
});
