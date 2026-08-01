import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PenImportNotice } from './PenImportNotice';
import type { OversizePrompt } from './useOutlineImport';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const PROMPT: OversizePrompt = {
  sourceWidthMm: 903.4,
  sourceDepthMm: 512.6,
  requiredWidthUnits: 21.5,
  requiredDepthUnits: 12.5,
  canGrow: true,
};

function renderNotice(overrides: Partial<OversizePrompt> = {}) {
  const onResolve = vi.fn();
  render(<PenImportNotice prompt={{ ...PROMPT, ...overrides }} onResolve={onResolve} />);
  return { onResolve };
}

describe('PenImportNotice', () => {
  it('announces itself, since it appears without the user opening it', () => {
    renderNotice();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('offers growing, scaling and cancelling when the drawer can grow', () => {
    const { onResolve } = renderNotice();
    fireEvent.click(screen.getByText('drawerShape.penImportGrow'));
    fireEvent.click(screen.getByText('drawerShape.penImportScale'));
    fireEvent.click(screen.getByText('common.cancel'));
    expect(onResolve.mock.calls.map((c) => c[0])).toEqual(['grow', 'scale', 'cancel']);
  });

  // Past the grid maximum the drawer cannot hold the shape, so offering to grow
  // it would be an action that silently does nothing.
  it('withholds growing when the drawer cannot get big enough', () => {
    renderNotice({ canGrow: false });
    expect(screen.queryByText('drawerShape.penImportGrow')).not.toBeInTheDocument();
    expect(screen.getByText('drawerShape.penImportScale')).toBeInTheDocument();
  });
});
