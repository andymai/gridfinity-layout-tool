import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useLabsStore } from '@/core/store';
import { useMobileStore } from '@/core/store/mobile';
import { Button } from '@/design-system';
import { resetAllStores } from '@/test/testUtils';

vi.mock('../MobileLayoutsPanel', () => ({
  MobileLayoutsPanel: () => <p>Layouts list</p>,
}));

vi.mock('@/features/places/components/PlacesFindList', () => ({
  PlacesFindList: ({ query, onDone }: { query: string; onDone: () => void }) => (
    <Button onClick={onDone}>{`Bins for ${query}`}</Button>
  ),
}));

import { MobileLayoutsFind } from './MobileLayoutsFind';

describe('MobileLayoutsFind', () => {
  beforeEach(() => {
    resetAllStores();
    useLabsStore.getState().disableFeature('places');
  });

  it('shows only the layouts while the places flag is off', () => {
    render(<MobileLayoutsFind />);
    expect(screen.getByText('Layouts list')).toBeInTheDocument();
    expect(screen.queryByLabelText('Find a bin')).toBeNull();
  });

  it('swaps the layouts for bin results while a search is typed', async () => {
    useLabsStore.getState().enableFeature('places');
    render(<MobileLayoutsFind />);
    const search = screen.getByLabelText('Find a bin');

    fireEvent.change(search, { target: { value: 'm3' } });
    expect(await screen.findByText('Bins for m3')).toBeInTheDocument();
    expect(screen.queryByText('Layouts list')).toBeNull();

    fireEvent.change(search, { target: { value: '' } });
    expect(screen.getByText('Layouts list')).toBeInTheDocument();
  });

  it('closes the sheet when a result is chosen', async () => {
    useLabsStore.getState().enableFeature('places');
    useMobileStore.getState().setActiveMobilePanel('layouts');
    render(<MobileLayoutsFind />);
    fireEvent.change(screen.getByLabelText('Find a bin'), { target: { value: 'm3' } });
    fireEvent.click(await screen.findByText('Bins for m3'));
    expect(useMobileStore.getState().activeMobilePanel).toBeNull();
  });
});
