import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BinPanelShell } from './BinPanelShell';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const pages = {
  shape: <div data-testid="page-shape" />,
  interior: <div data-testid="page-interior" />,
  features: <div data-testid="page-features" />,
  style: <div data-testid="page-style" />,
  print: <div data-testid="page-print" />,
};

describe('BinPanelShell', () => {
  beforeEach(() => {
    localStorage.clear();
    useDesignerStore.setState({ ui: { ...DEFAULT_UI_STATE } });
  });

  it('keeps every page mounted with only the active one visible', () => {
    render(<BinPanelShell frame="plain" pages={pages} />);
    expect(screen.getByTestId('page-shape')).toBeInTheDocument();
    expect(screen.getByTestId('page-style')).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toContainElement(screen.getByTestId('page-shape'));
  });

  it('persists the picked category', () => {
    render(<BinPanelShell frame="plain" pages={pages} />);
    fireEvent.click(screen.getByRole('tab', { name: 'binDesigner.category.print' }));
    expect(localStorage.getItem('gridfinity-designer-category-v1')).toBe('print');
    expect(useDesignerStore.getState().ui.activeCategory).toBe('print');
  });

  it('restores the persisted category on mount', () => {
    localStorage.setItem('gridfinity-designer-category-v1', 'style');
    render(<BinPanelShell frame="plain" pages={pages} />);
    expect(useDesignerStore.getState().ui.activeCategory).toBe('style');
  });

  it('ignores an invalid persisted category', () => {
    localStorage.setItem('gridfinity-designer-category-v1', 'bogus');
    render(<BinPanelShell frame="plain" pages={pages} />);
    expect(useDesignerStore.getState().ui.activeCategory).toBe('shape');
  });

  it('routes a help-jump deep link to the owning category', () => {
    render(<BinPanelShell frame="plain" pages={pages} />);
    window.dispatchEvent(
      new CustomEvent('help-jump:binDesigner:finishing', { detail: { controlId: 'bd-colors' } })
    );
    expect(useDesignerStore.getState().ui.activeCategory).toBe('style');
  });

  it('wraps the page region when asked', () => {
    render(
      <BinPanelShell
        frame="plain"
        pages={pages}
        wrapPages={(node) => <div data-testid="lock">{node}</div>}
      />
    );
    expect(screen.getByTestId('lock')).toContainElement(screen.getByTestId('page-shape'));
  });
});
