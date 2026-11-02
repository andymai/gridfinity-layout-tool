import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { Cutout } from '@/features/bin-designer/types';
import { ShadowBoardButton } from './ShadowBoardButton';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const exportShadowBoard = vi.fn(async () => true);
vi.mock('../panel/CutoutsSection/shadowBoard', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useShadowBoardExport: () => exportShadowBoard,
}));

const pocket: Cutout = {
  id: 'p',
  shape: 'rectangle',
  x: 10,
  y: 10,
  width: 20,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
};

const trigger = () => screen.getByRole('button', { name: 'binDesigner.shadowBoard.button' });

describe('ShadowBoardButton', () => {
  beforeEach(() => {
    exportShadowBoard.mockClear();
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('waits for a pocket to export', () => {
    render(<ShadowBoardButton />);
    expect(trigger()).toBeDisabled();
  });

  it('exports the picked format, with clearance when asked', async () => {
    useDesignerStore.getState().addCutout(pocket);
    render(<ShadowBoardButton />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('radio', { name: 'binDesigner.shadowBoard.format.dxf' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'binDesigner.shadowBoard.clearance' }));
    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.shadowBoard.download.dxf' }));
    await waitFor(() => expect(exportShadowBoard).toHaveBeenCalledWith('dxf', true));
  });
});
