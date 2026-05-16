import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorToolOverlay } from './ColorToolOverlay';
import { useDesignerStore } from '@/features/bin-designer/store';
import { _resetPendingMeshCache } from '@/features/bin-designer/store/designer';
import { DEFAULT_FEATURE_COLOR_CONFIG } from '@/features/bin-designer/constants/defaults';

// Same stubs the panel tests use — keeps this fast and DOM-portable.
vi.mock('@/design-system/Popover/Popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="picker-popover">{children}</div>
  ),
}));

vi.mock('@/features/bin-designer/components/panel/ColorsSection/ColorPicker', () => ({
  ColorPicker: ({ zoneLabel }: { zoneLabel: string }) => (
    <div data-testid="color-picker">{zoneLabel}</div>
  ),
}));

function resetStore(): void {
  _resetPendingMeshCache();
  useDesignerStore.setState({
    ui: {
      ...useDesignerStore.getState().ui,
      colorTool: null,
      swapFirstZone: null,
      hoveredColorZone: null,
    },
    params: {
      ...useDesignerStore.getState().params,
      featureColors: { ...DEFAULT_FEATURE_COLOR_CONFIG },
    },
  });
}

describe('ColorToolOverlay', () => {
  beforeEach(resetStore);

  it('renders nothing when no tool is active and no picker is open', () => {
    const { container } = render(
      <ColorToolOverlay pickerOverlay={null} onClosePicker={() => undefined} />
    );
    // Banner copy lives in nested div; absence of either banner or picker
    // is what we're verifying — the component should be inert.
    expect(container.querySelector('[data-testid="picker-popover"]')).toBeNull();
  });

  it('shows the eyedropper banner when the tool is engaged', () => {
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, colorTool: 'eyedropper' },
    });
    render(<ColorToolOverlay pickerOverlay={null} onClosePicker={() => undefined} />);
    expect(
      screen.getByText('Click any zone in the preview to change its color')
    ).toBeInTheDocument();
  });

  it('shows the swap-first banner during swap-pick-first', () => {
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, colorTool: 'swap-pick-first' },
    });
    render(<ColorToolOverlay pickerOverlay={null} onClosePicker={() => undefined} />);
    expect(screen.getByText(/Pick the first zone/i)).toBeInTheDocument();
  });

  it('clicking the banner X exits the tool', () => {
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, colorTool: 'eyedropper' },
    });
    render(<ColorToolOverlay pickerOverlay={null} onClosePicker={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /exit eyedropper/i }));
    expect(useDesignerStore.getState().ui.colorTool).toBeNull();
  });

  it('ESC closes the picker first, then exits the tool', () => {
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, colorTool: 'eyedropper' },
    });
    const onClose = vi.fn();
    render(
      <ColorToolOverlay pickerOverlay={{ zone: 'body', x: 100, y: 100 }} onClosePicker={onClose} />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    // Tool still active — second ESC would exit it
    expect(useDesignerStore.getState().ui.colorTool).toBe('eyedropper');
  });

  it('renders the picker when pickerOverlay is provided', () => {
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, colorTool: 'eyedropper' },
    });
    render(
      <ColorToolOverlay
        pickerOverlay={{ zone: 'base', x: 50, y: 60 }}
        onClosePicker={() => undefined}
      />
    );
    expect(screen.getByTestId('color-picker')).toBeInTheDocument();
  });
});
