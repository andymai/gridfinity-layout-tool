import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { WorkspaceHeader } from './WorkspaceHeader';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/features/bin-designer/store', () => ({
  useDesignerStore: vi.fn(),
}));

describe('WorkspaceHeader', () => {
  beforeEach(() => {
    vi.mocked(useDesignerStore).mockReturnValue(vi.fn());
  });

  it('renders the workspace title', () => {
    render(
      <WorkspaceHeader
        zoomPercent={100}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFitToView={vi.fn()}
      />
    );

    expect(screen.getByText('binDesigner.cutoutEditor.title')).toBeInTheDocument();
  });

  it('displays the zoom percentage', () => {
    render(
      <WorkspaceHeader
        zoomPercent={125}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFitToView={vi.fn()}
      />
    );

    expect(screen.getByText('125%')).toBeInTheDocument();
  });

  it('renders zoom control buttons', () => {
    render(
      <WorkspaceHeader
        zoomPercent={100}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFitToView={vi.fn()}
      />
    );

    expect(screen.getByTitle('binDesigner.cutoutEditor.zoomIn')).toBeInTheDocument();
    expect(screen.getByTitle('binDesigner.cutoutEditor.zoomOut')).toBeInTheDocument();
  });

  it('renders the done button', () => {
    render(
      <WorkspaceHeader
        zoomPercent={100}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFitToView={vi.fn()}
      />
    );

    expect(screen.getByText('binDesigner.cutoutEditor.done')).toBeInTheDocument();
  });
});
