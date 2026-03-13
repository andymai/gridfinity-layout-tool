import type { RefObject } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { resetAllStores } from '@/test/testUtils';

// Mock grid ref that returns consistent coords
export function createMockGridRef(width = 320, height = 256): RefObject<HTMLDivElement> {
  const mockElement = {
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width,
      height,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => {},
    }),
  } as HTMLDivElement;

  return { current: mockElement };
}

export function setupStores(): void {
  resetAllStores();
  const { layout } = useLayoutStore.getState();
  useSelectionStore.setState({
    activeLayerId: layout.layers[0].id,
    activeCategoryId: layout.categories[0].id,
  });
}
