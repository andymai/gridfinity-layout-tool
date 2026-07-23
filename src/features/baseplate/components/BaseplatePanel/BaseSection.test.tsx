import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BaseSection } from './BaseSection';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('BaseSection', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('renders magnet, solid floor, and corner radius controls when not stacking', () => {
    render(<BaseSection />);
    expect(screen.getByText('baseplate.magnetHoles')).toBeInTheDocument();
    expect(screen.getByText('baseplate.solidFloor')).toBeInTheDocument();
  });

  it('toggling magnet holes writes through to the layout store', () => {
    render(<BaseSection />);
    const before =
      useLayoutStore.getState().layout.baseplateParams?.magnetHoles ??
      DEFAULT_BASEPLATE_PARAMS.magnetHoles;
    fireEvent.click(screen.getByRole('switch', { name: 'baseplate.magnetHoles' }));
    expect(useLayoutStore.getState().layout.baseplateParams?.magnetHoles).toBe(!before);
  });

  it('renders nothing when stacking hides every control and the plate is unsplit', () => {
    useLayoutStore.getState().setBaseplateParams({
      ...DEFAULT_BASEPLATE_PARAMS,
      stackPrint: { enabled: true, copies: 2, gapMm: 0.2 },
    });
    const { container } = render(<BaseSection />);
    expect(container).toBeEmptyDOMElement();
  });
});
