import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLayoutStore } from '@/core/store/layout';
import { binId, designId } from '@/core/types';
import { createTestBin, createTestLayout, resetAllStores } from '@/test/testUtils';
import { resetCustomBinsCache } from '../../hooks/useCustomBins';
import { useDesignerStore } from '../../store';
import { upsertRegistryEntry } from '../../store/customBinRegistry';
import { LayoutDesignSwitch } from './LayoutDesignSwitch';

function registerDesign(id: string, name: string): void {
  upsertRegistryEntry({
    id: designId(id),
    name,
    width: 2,
    depth: 3,
    height: 6,
    updatedAt: '2026-10-22T00:00:00.000Z',
  });
}

function seedLayout(): void {
  useLayoutStore.setState({
    layout: createTestLayout({
      name: 'Kitchen drawer',
      bins: [
        createTestBin({ id: binId('b1'), linkedDesignId: designId('d1') }),
        createTestBin({ id: binId('b2'), linkedDesignId: designId('d2') }),
      ],
    }),
  });
}

describe('LayoutDesignSwitch', () => {
  beforeEach(() => {
    resetAllStores();
    localStorage.clear();
    window.history.replaceState(null, '', '/designer?id=d1');
    registerDesign('d1', 'Spice rack');
    registerDesign('d2', 'Utensils');
    resetCustomBinsCache();
    useDesignerStore.setState({ currentDesignId: 'd1' });
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('renders nothing when no bin in the layout is linked to a saved design', () => {
    useLayoutStore.setState({ layout: createTestLayout({ bins: [createTestBin()] }) });

    const { container } = render(<LayoutDesignSwitch />);

    expect(container.firstChild).toBeNull();
  });

  it("lists the layout's designs under the layout name, marking the open one", async () => {
    seedLayout();
    render(<LayoutDesignSwitch />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Switch to another bin in this layout' })
    );

    const menu = screen.getByRole('menu', { name: 'Kitchen drawer' });
    expect(menu).toHaveTextContent('Kitchen drawer');
    expect(screen.getByRole('menuitem', { name: /Spice rack/ })).toHaveAttribute(
      'aria-current',
      'true'
    );
    expect(screen.getByRole('menuitem', { name: /Utensils/ })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('menuitem', { name: /Utensils/ })).toHaveTextContent('2×3 · 6u');
  });

  it('opens another design from the bin it is placed as', async () => {
    seedLayout();
    render(<LayoutDesignSwitch />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Switch to another bin in this layout' })
    );
    await userEvent.click(screen.getByRole('menuitem', { name: /Utensils/ }));

    expect(window.location.search).toBe('?id=d2&bin=b2');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('only closes when the open design is chosen', async () => {
    seedLayout();
    render(<LayoutDesignSwitch />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Switch to another bin in this layout' })
    );
    await userEvent.click(screen.getByRole('menuitem', { name: /Spice rack/ }));

    expect(window.location.search).toBe('?id=d1');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('hands off to the full design list', async () => {
    seedLayout();
    render(<LayoutDesignSwitch />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Switch to another bin in this layout' })
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'All designs…' }));

    expect(useDesignerStore.getState().ui.designListOpen).toBe(true);
  });
});
