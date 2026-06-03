import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InspectorDock } from './InspectorDock';
import type { Cutout } from '@/features/bin-designer/types';
import { loadInspectorCollapsed } from './inspectorDockStorage';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('./InspectorContent', () => ({
  InspectorContent: () => <div data-testid="inspector-content" />,
}));

const baseProps = {
  cutouts: [] as Cutout[],
  selection: new Set<string>(),
  preview: new Map<string, Partial<Cutout>>(),
  binWidth: 100,
  binDepth: 100,
  maxCutDepth: 10,
  onUpdate: vi.fn(),
};

describe('InspectorDock', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the header title and the content body when expanded', () => {
    render(<InspectorDock {...baseProps} />);
    expect(screen.getByText('binDesigner.cutoutEditor.inspectorTitle')).toBeInTheDocument();
    expect(screen.getByTestId('inspector-content')).toBeInTheDocument();
  });

  it('collapses to a rail (hiding the content) and persists the collapsed state', () => {
    render(<InspectorDock {...baseProps} />);
    fireEvent.click(screen.getByLabelText('binDesigner.cutoutEditor.inspectorCollapse'));
    expect(screen.queryByTestId('inspector-content')).not.toBeInTheDocument();
    expect(screen.getByLabelText('binDesigner.cutoutEditor.inspectorExpand')).toBeInTheDocument();
    expect(loadInspectorCollapsed()).toBe(true);
  });

  it('starts collapsed when persisted state says so, and can expand back', () => {
    localStorage.setItem('gridfinity-cutout-inspector-collapsed', '1');
    render(<InspectorDock {...baseProps} />);
    expect(screen.queryByTestId('inspector-content')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('binDesigner.cutoutEditor.inspectorExpand'));
    expect(screen.getByTestId('inspector-content')).toBeInTheDocument();
    expect(loadInspectorCollapsed()).toBe(false);
  });

  it('exposes a resize separator when expanded', () => {
    render(<InspectorDock {...baseProps} />);
    expect(screen.getByLabelText('binDesigner.cutoutEditor.inspectorResize')).toBeInTheDocument();
  });
});
