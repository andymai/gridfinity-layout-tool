import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { IsometricPreviewControls } from './IsometricPreviewControls';
import type { Layer } from '@/core/types';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

const defaultProps = {
  sceneRef: { current: null },
  isPreviewExpanded: false,
  isMobile: false,
  isTablet: false,
  layers: [{ id: 'layer-1', name: 'Layer 1', height: 3 }] as Layer[],
  layerViewMode: 'all' as const,
  isExplodedView: false,
  showBananaScale: false,
  setLayerViewMode: vi.fn(),
  togglePreviewExpanded: vi.fn(),
  setPreviewExpanded: vi.fn(),
  toggleIsometricPreview: vi.fn(),
  toggleExplodedView: vi.fn(),
  updateBananaScale: vi.fn(),
};

describe('IsometricPreviewControls', () => {
  it('renders camera preset buttons', () => {
    const { container } = render(<IsometricPreviewControls {...defaultProps} />);
    const buttons = container.querySelectorAll('button');
    // Isometric, Front, Side, Banana, Expand/Collapse, Close = 6 buttons
    expect(buttons.length).toBeGreaterThanOrEqual(4);
  });

  it('renders layer view mode selector with multiple layers', () => {
    const props = {
      ...defaultProps,
      layers: [
        { id: 'layer-1', name: 'Layer 1', height: 3 },
        { id: 'layer-2', name: 'Layer 2', height: 3 },
      ] as Layer[],
    };
    const { container } = render(<IsometricPreviewControls {...props} />);
    const buttons = container.querySelectorAll('button');
    // Camera (4) + Layer modes (focus, stack, all, explode) + Expand + Close = 10
    expect(buttons.length).toBeGreaterThanOrEqual(8);
  });

  it('does not render layer view mode selector with single layer', () => {
    const { container } = render(<IsometricPreviewControls {...defaultProps} />);
    // Only camera presets + expand + close buttons
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(6);
  });

  it('renders keyboard shortcuts in expanded desktop mode', () => {
    const props = {
      ...defaultProps,
      isPreviewExpanded: true,
    };
    const { container } = render(<IsometricPreviewControls {...props} />);
    const kbds = container.querySelectorAll('kbd');
    expect(kbds.length).toBeGreaterThanOrEqual(4);
  });

  it('does not render keyboard shortcuts on mobile', () => {
    const props = {
      ...defaultProps,
      isPreviewExpanded: true,
      isMobile: true,
    };
    const { container } = render(<IsometricPreviewControls {...props} />);
    const kbds = container.querySelectorAll('kbd');
    expect(kbds.length).toBe(0);
  });
});
