import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorToolOverlay } from './ColorToolOverlay';
import { useDesignerStore } from '@/features/bin-designer/store';
import { _resetPendingMeshCache } from '@/features/bin-designer/store/designer';
import { DEFAULT_FEATURE_COLOR_CONFIG } from '@/features/bin-designer/constants/defaults';

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
      pickerOverlay: null,
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
    const { container } = render(<ColorToolOverlay onClosePicker={() => undefined} />);
    expect(container.querySelector('[data-testid="picker-popover"]')).toBeNull();
  });

  it('shows the eyedropper banner when the tool is engaged', () => {
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, colorTool: 'eyedropper' },
    });
    render(<ColorToolOverlay onClosePicker={() => undefined} />);
    expect(
      screen.getByText('Click any zone in the preview to change its color')
    ).toBeInTheDocument();
  });

  it('shows the swap-first banner during swap-pick-first', () => {
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, colorTool: 'swap-pick-first' },
    });
    render(<ColorToolOverlay onClosePicker={() => undefined} />);
    expect(screen.getByText(/Pick the first zone/i)).toBeInTheDocument();
  });

  it('clicking the banner X exits the tool', () => {
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, colorTool: 'eyedropper' },
    });
    render(<ColorToolOverlay onClosePicker={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /exit eyedropper/i }));
    expect(useDesignerStore.getState().ui.colorTool).toBeNull();
  });

  it('ESC closes the picker first, then exits the tool', () => {
    useDesignerStore.setState({
      ui: {
        ...useDesignerStore.getState().ui,
        colorTool: 'eyedropper',
        pickerOverlay: { zone: 'body', x: 100, y: 100 },
      },
    });
    const onClose = vi.fn();
    render(<ColorToolOverlay onClosePicker={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    // Tool still active — second ESC would exit it
    expect(useDesignerStore.getState().ui.colorTool).toBe('eyedropper');
  });

  it('renders the picker when pickerOverlay is in the store', () => {
    useDesignerStore.setState({
      ui: {
        ...useDesignerStore.getState().ui,
        colorTool: 'eyedropper',
        pickerOverlay: { zone: 'base', x: 50, y: 60 },
      },
    });
    render(<ColorToolOverlay onClosePicker={() => undefined} />);
    expect(screen.getByTestId('color-picker')).toBeInTheDocument();
  });

  it('setColorTool(null) clears pickerOverlay so toolbar exit closes the picker', () => {
    useDesignerStore.setState({
      ui: {
        ...useDesignerStore.getState().ui,
        colorTool: 'eyedropper',
        pickerOverlay: { zone: 'body', x: 100, y: 100 },
      },
    });
    useDesignerStore.getState().setColorTool(null);
    expect(useDesignerStore.getState().ui.pickerOverlay).toBeNull();
  });

  it('disabling multi-color clears pickerOverlay along with the tool state', () => {
    useDesignerStore.setState({
      ui: {
        ...useDesignerStore.getState().ui,
        colorTool: 'eyedropper',
        pickerOverlay: { zone: 'body', x: 100, y: 100 },
      },
    });
    useDesignerStore.getState().updateFeatureColors({ enabled: false });
    const { ui } = useDesignerStore.getState();
    expect(ui.pickerOverlay).toBeNull();
    expect(ui.colorTool).toBeNull();
  });
});
