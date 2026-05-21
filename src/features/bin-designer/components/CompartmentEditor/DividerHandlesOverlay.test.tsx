import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DividerHandlesOverlay } from './DividerHandlesOverlay';
import type { DividerHandle } from './useDividerHandles';

describe('DividerHandlesOverlay', () => {
  it('renders nothing when handles are empty', () => {
    const { container } = render(
      <DividerHandlesOverlay
        handles={[]}
        drag={null}
        innerW={80}
        innerD={80}
        onHandlePointerDown={() => () => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders one button per handle', () => {
    const handles: DividerHandle[] = [
      {
        divider: {
          compartmentA: 0,
          compartmentB: 1,
          axis: 'horizontal',
          offsetStart: 0,
          offsetEnd: 0,
        },
        which: 'start',
        visualX: 0,
        visualY: 0.5,
        currentOffsetMm: 0,
      },
      {
        divider: {
          compartmentA: 0,
          compartmentB: 1,
          axis: 'horizontal',
          offsetStart: 0,
          offsetEnd: 0,
        },
        which: 'end',
        visualX: 1,
        visualY: 0.5,
        currentOffsetMm: 0,
      },
    ];
    const { container } = render(
      <DividerHandlesOverlay
        handles={handles}
        drag={null}
        innerW={80}
        innerD={80}
        onHandlePointerDown={() => () => {}}
      />
    );
    expect(container.querySelectorAll('button')).toHaveLength(2);
  });
});
