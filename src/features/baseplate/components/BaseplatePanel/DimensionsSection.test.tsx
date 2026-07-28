import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DimensionsSection } from './DimensionsSection';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { mm } from '@/core/types';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('DimensionsSection', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('renders the sync toggle, steppers, and padding controls', () => {
    render(<DimensionsSection />);
    expect(screen.getByLabelText('baseplate.syncWithLayout')).toBeInTheDocument();
    expect(screen.getByText('baseplate.gridWidth')).toBeInTheDocument();
    expect(screen.getByText('baseplate.gridDepth')).toBeInTheDocument();
    expect(screen.getByText('baseplate.padding')).toBeInTheDocument();
  });

  it('unchecking sync stores explicit dimensions copied from the drawer', () => {
    render(<DimensionsSection />);
    fireEvent.click(screen.getByLabelText('baseplate.syncWithLayout'));
    const params = useLayoutStore.getState().layout.baseplateParams;
    expect(params?.syncWithLayout).toBe(false);
    expect(params?.baseplateWidth).toBe(useLayoutStore.getState().layout.drawer.width);
    expect(params?.baseplateDepth).toBe(useLayoutStore.getState().layout.drawer.depth);
  });

  it('re-checking sync restores layout-driven dimensions', () => {
    render(<DimensionsSection />);
    const toggle = screen.getByLabelText('baseplate.syncWithLayout');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(useLayoutStore.getState().layout.baseplateParams?.syncWithLayout).toBe(true);
  });

  describe('margin seam connector style gate', () => {
    /** Padding above the detach threshold, so the connector row renders. */
    function detachablePlate(connectorStyle: 'dovetailKey' | 'snapClip' | 'puzzle'): void {
      const current = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      useLayoutStore.getState().setBaseplateParams({
        ...current,
        paddingLeft: mm(12),
        paddingRight: mm(12),
        detachMargins: true,
        connectorNubs: true,
        connectorStyle,
      });
    }

    const connectorRow = () =>
      screen.getByRole('checkbox', { name: 'baseplate.detachMarginConnector' });
    const storedConnector = () =>
      useLayoutStore.getState().layout.baseplateParams?.detachMarginConnector;

    it('offers the connector for the puzzle key style (#2866)', () => {
      detachablePlate('dovetailKey');
      render(<DimensionsSection />);
      expect(screen.getByText('baseplate.detachMarginConnectorHint')).toBeInTheDocument();
      fireEvent.click(connectorRow());
      expect(storedConnector()).toBe(true);
    });

    it('still blocks it for the snap clip style', () => {
      // The top-insert clip has no seated form at a body↔rail seam.
      detachablePlate('snapClip');
      render(<DimensionsSection />);
      expect(connectorRow()).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByText('baseplate.detachMarginConnectorStyle')).toBeInTheDocument();
      fireEvent.click(connectorRow());
      expect(storedConnector()).toBeUndefined();
    });

    it('leaves the integral styles working', () => {
      detachablePlate('puzzle');
      render(<DimensionsSection />);
      fireEvent.click(connectorRow());
      expect(storedConnector()).toBe(true);
    });
  });
});
