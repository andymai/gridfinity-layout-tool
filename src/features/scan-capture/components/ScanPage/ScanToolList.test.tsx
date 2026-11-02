import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SceneShape } from '@/shared/scanTrace';
import { ScanToolList } from './ScanToolList';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const box = (w: number, h: number): SceneShape => {
  const points = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  return { imagePoints: points, outputPoints: points };
};

describe('ScanToolList', () => {
  it('numbers each tool and shows its size in millimetres', () => {
    render(<ScanToolList shapes={[box(120, 30), box(40, 12.5)]} units="mm" onRemove={vi.fn()} />);
    expect(screen.getAllByText('scan.review.toolLabel')).toHaveLength(2);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getAllByText('binDesigner.cutouts.scanImport.resultSize')).toHaveLength(2);
  });

  it('shows no size for an unscaled scan', () => {
    render(<ScanToolList shapes={[box(120, 30), box(40, 12)]} units="px" onRemove={vi.fn()} />);
    expect(screen.queryByText('binDesigner.cutouts.scanImport.resultSize')).toBeNull();
  });

  it('removes the tool whose button was pressed', () => {
    const onRemove = vi.fn();
    render(<ScanToolList shapes={[box(120, 30), box(40, 12)]} units="mm" onRemove={onRemove} />);
    fireEvent.click(screen.getAllByLabelText('scan.review.removeTool')[1]);
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('locks removal while the outlines are changing', () => {
    render(
      <ScanToolList shapes={[box(120, 30), box(40, 12)]} units="mm" disabled onRemove={vi.fn()} />
    );
    for (const button of screen.getAllByLabelText('scan.review.removeTool')) {
      expect(button).toBeDisabled();
    }
  });
});
