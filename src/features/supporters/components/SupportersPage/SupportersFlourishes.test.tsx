import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CtaBurst } from './SupportersFlourishes';

describe('CtaBurst', () => {
  it('finishes immediately when no 2D canvas is available', () => {
    const onDone = vi.fn();
    render(<CtaBurst origin={{ x: 0, y: 0 }} accent="#f00" seed={1} onDone={onDone} />);
    expect(onDone).toHaveBeenCalledOnce();
  });
});
