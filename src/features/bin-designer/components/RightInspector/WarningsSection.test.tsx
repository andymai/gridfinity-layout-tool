import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WarningsSection } from './WarningsSection';
import type { DesignWarning } from './useDesignWarnings';

describe('WarningsSection', () => {
  it('renders nothing as a list when there are no warnings', () => {
    render(<WarningsSection warnings={[]} />);
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  it('renders one row per warning and a jump action only when a target exists', () => {
    const warnings: DesignWarning[] = [
      {
        id: 'a',
        severity: 'blocker',
        message: 'Lid won’t grip',
        jumpTarget: { surface: 'binDesigner:shape', controlId: 'bd-lid' },
      },
      { id: 'b', severity: 'warning', message: 'Will be split' },
    ];
    render(<WarningsSection warnings={warnings} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
