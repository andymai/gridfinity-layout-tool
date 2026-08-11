import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BentoQuickstartOverlay } from './BentoQuickstartOverlay';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('BentoQuickstartOverlay', () => {
  it('names the three things the grid cannot show on its own', () => {
    render(<BentoQuickstartOverlay onDismiss={vi.fn()} />);

    expect(screen.getByText('binDesigner.bento.quickstart.merge')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.bento.quickstart.dragWalls')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.bento.quickstart.freeDrag')).toBeInTheDocument();
  });

  it('dismisses on the button', () => {
    const onDismiss = vi.fn();
    render(<BentoQuickstartOverlay onDismiss={onDismiss} />);

    fireEvent.click(screen.getByText('binDesigner.cutoutEditor.quickstart.dismiss'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses on Escape', () => {
    const onDismiss = vi.fn();
    render(<BentoQuickstartOverlay onDismiss={onDismiss} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('focuses the dismiss button so keyboard users are not stranded behind it', () => {
    render(<BentoQuickstartOverlay onDismiss={vi.fn()} />);

    expect(screen.getByText('binDesigner.cutoutEditor.quickstart.dismiss').closest('button')).toBe(
      document.activeElement
    );
  });

  it('is exposed as a dialog with an accessible name', () => {
    render(<BentoQuickstartOverlay onDismiss={vi.fn()} />);

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'bento-quickstart-title');
  });
});
