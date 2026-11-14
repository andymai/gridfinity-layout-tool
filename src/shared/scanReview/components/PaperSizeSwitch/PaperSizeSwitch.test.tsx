import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaperSizeSwitch } from './PaperSizeSwitch';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('PaperSizeSwitch', () => {
  it('shows the sheet in use and offers the other size and no sheet at all', () => {
    render(<PaperSizeSwitch value="a4" onChange={vi.fn()} />);
    const chosen = screen.getByRole('radio', { checked: true });
    expect(chosen).toHaveTextContent('binDesigner.cutouts.traceView.paper.a4');
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByText('scan.paper.hint')).toBeInTheDocument();
  });

  it('says nothing about sizes once the sheet is ruled out', () => {
    render(<PaperSizeSwitch value="off" onChange={vi.fn()} />);
    expect(screen.queryByText('scan.paper.hint')).toBeNull();
  });

  it('reports the choice made', () => {
    const onChange = vi.fn();
    render(<PaperSizeSwitch value="a4" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'scan.paper.notPaper' }));
    expect(onChange).toHaveBeenCalledWith('off');
  });
});
