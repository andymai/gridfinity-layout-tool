import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ToolsTab } from './ToolsTab';
import {
  useInteractionStore,
  useLayoutStore,
  useMobileStore,
  useSelectionStore,
} from '@/core/store';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('ToolsTab', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<ToolsTab />);
  });

  it('arms the gap picker and closes the sheet so the grid is reachable', () => {
    useSelectionStore.getState().setActiveLayer(useLayoutStore.getState().layout.layers[0].id);
    useMobileStore.getState().setActiveMobilePanel('layers');
    render(<ToolsTab />);

    fireEvent.click(screen.getByTestId('mobile-tools-find-bins-that-fit'));

    expect(useInteractionStore.getState().gapSelectArmed).toBe(true);
    expect(useMobileStore.getState().activeMobilePanel).toBeNull();
  });
});
