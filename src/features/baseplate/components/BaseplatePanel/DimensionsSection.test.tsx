import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DimensionsSection } from './DimensionsSection';
import { useLayoutStore } from '@/core/store/layout';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return Object.entries(params).reduce((str, [k, v]) => str.replace(`{${k}}`, String(v)), key);
    }
    return key;
  },
}));

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
});
