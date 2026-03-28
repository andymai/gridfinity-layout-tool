import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DesignerMainContent } from './DesignerMainContent';

vi.mock('@/features/bin-designer/components/ParameterPanel', () => ({
  ParameterPanel: () => <div data-testid="parameter-panel">Parameter Panel</div>,
}));

vi.mock('@/features/bin-designer/components/PreviewCanvas', () => ({
  PreviewCanvas: () => <div data-testid="preview-canvas">Preview Canvas</div>,
}));

vi.mock('@/features/bin-designer/components/CutoutWorkspace', () => ({
  CutoutWorkspace: () => <div data-testid="cutout-workspace">Cutout Workspace</div>,
}));

vi.mock('@/features/bin-designer/components/CutoutWorkspace/ResizeDivider', () => ({
  ResizeDivider: () => <div data-testid="resize-divider">Resize Divider</div>,
}));

describe('DesignerMainContent', () => {
  it('renders desktop side-by-side layout', () => {
    render(
      <DesignerMainContent
        isDesktop
        isMobile={false}
        isLandscape={false}
        cutoutEditorOpen={false}
      />
    );
    expect(screen.getByTestId('parameter-panel')).toBeInTheDocument();
    expect(screen.getByTestId('preview-canvas')).toBeInTheDocument();
  });

  it('renders cutout workspace when cutout editor is open on desktop', () => {
    render(<DesignerMainContent isDesktop isMobile={false} isLandscape={false} cutoutEditorOpen />);
    expect(screen.getByTestId('cutout-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('resize-divider')).toBeInTheDocument();
    expect(screen.queryByTestId('parameter-panel')).not.toBeInTheDocument();
  });

  it('renders stacked layout on mobile portrait', () => {
    render(
      <DesignerMainContent
        isDesktop={false}
        isMobile
        isLandscape={false}
        cutoutEditorOpen={false}
      />
    );
    expect(screen.getByTestId('parameter-panel')).toBeInTheDocument();
    expect(screen.getByTestId('preview-canvas')).toBeInTheDocument();
  });

  it('renders landscape layout', () => {
    render(
      <DesignerMainContent
        isDesktop={false}
        isMobile={false}
        isLandscape
        cutoutEditorOpen={false}
      />
    );
    expect(screen.getByTestId('parameter-panel')).toBeInTheDocument();
    expect(screen.getByTestId('preview-canvas')).toBeInTheDocument();
  });

  it('shows cutout desktop-only banner on non-desktop with cutout open', () => {
    render(
      <DesignerMainContent
        isDesktop={false}
        isMobile={false}
        isLandscape={false}
        cutoutEditorOpen
      />
    );
    expect(screen.getByText(/desktop/i)).toBeInTheDocument();
  });
});
