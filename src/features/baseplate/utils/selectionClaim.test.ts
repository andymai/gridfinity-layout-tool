import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from '@/core/store/layout';
import { layoutId } from '@/core/types';
import { claimSelection } from './selectionClaim';

describe('claimSelection', () => {
  beforeEach(() => {
    useLayoutStore.setState({ activeLayoutId: layoutId('layout-a') });
  });

  it('holds while nothing newer starts', () => {
    const superseded = claimSelection();
    expect(superseded()).toBe(false);
  });

  it('gives way to a newer claim', () => {
    const first = claimSelection();
    const second = claimSelection();
    expect(first()).toBe(true);
    expect(second()).toBe(false);
  });

  it('gives way when another layout opens', () => {
    const superseded = claimSelection();
    useLayoutStore.setState({ activeLayoutId: layoutId('layout-b') });
    expect(superseded()).toBe(true);
  });
});
