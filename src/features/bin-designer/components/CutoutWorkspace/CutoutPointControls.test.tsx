import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CutoutPointControls, type PointTool } from './CutoutPointControls';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function tool(overrides: Partial<PointTool> = {}): PointTool {
  return {
    editingId: null,
    selectedCount: 0,
    onEdit: vi.fn(),
    onDone: vi.fn(),
    onKind: vi.fn(),
    ...overrides,
  };
}

const button = (key: string) =>
  screen.getByRole('button', { name: `binDesigner.cutouts.points.${key}` });

describe('CutoutPointControls', () => {
  it('opens the points of this path', () => {
    const t = tool();
    render(<CutoutPointControls cutoutId="p" tool={t} />);
    fireEvent.click(button('edit'));
    expect(t.onEdit).toHaveBeenCalledWith('p');
    expect(screen.getByText('binDesigner.cutouts.points.editHint')).toBeInTheDocument();
  });

  it('offers Edit points while another path is the one open', () => {
    render(<CutoutPointControls cutoutId="p" tool={tool({ editingId: 'q' })} />);
    expect(button('edit')).toBeEnabled();
  });

  it('makes the selected points smooth or sharp while they are open', () => {
    const t = tool({ editingId: 'p', selectedCount: 3 });
    render(<CutoutPointControls cutoutId="p" tool={t} />);
    fireEvent.click(button('smooth'));
    fireEvent.click(button('corner'));
    expect(t.onKind).toHaveBeenNthCalledWith(1, 'smooth');
    expect(t.onKind).toHaveBeenNthCalledWith(2, 'corner');
  });

  it('holds the point kinds back until a point is selected', () => {
    render(<CutoutPointControls cutoutId="p" tool={tool({ editingId: 'p' })} />);
    expect(button('smooth')).toBeDisabled();
    expect(button('corner')).toBeDisabled();
    expect(screen.getByText('binDesigner.cutouts.points.noneSelected')).toBeInTheDocument();
  });

  it('closes the points with Done', () => {
    const t = tool({ editingId: 'p', selectedCount: 1 });
    render(<CutoutPointControls cutoutId="p" tool={t} />);
    fireEvent.click(button('done'));
    expect(t.onDone).toHaveBeenCalledOnce();
  });
});
