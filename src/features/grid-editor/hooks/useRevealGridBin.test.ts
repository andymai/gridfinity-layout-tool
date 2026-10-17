import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { binId } from '@/core/types';
import { revealBin } from '@/shared/events/revealBin';
import { useRevealGridBin } from './useRevealGridBin';

describe('useRevealGridBin', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('scrolls the revealed bin into view and focuses it while mounted', async () => {
    const element = document.createElement('div');
    element.tabIndex = 0;
    element.dataset.binId = 'found';
    element.scrollIntoView = vi.fn();
    document.body.append(element);

    const { unmount } = renderHook(() => useRevealGridBin());
    revealBin(binId('found'));
    await vi.waitFor(() => expect(element.scrollIntoView).toHaveBeenCalledTimes(1));
    expect(document.activeElement).toBe(element);

    unmount();
    revealBin(binId('found'));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(element.scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
