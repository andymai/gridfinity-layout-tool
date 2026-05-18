import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HelpTargetMarker } from './HelpTargetMarker';
import { HELP_TARGET_ATTR } from '@/shared/help/helpJumpDispatcher';

describe('HelpTargetMarker', () => {
  it('renders children inside a div carrying the data-help-target attribute', () => {
    const { container } = render(
      <HelpTargetMarker id="print-bed-size">
        <span>child</span>
      </HelpTargetMarker>
    );
    const target = container.querySelector(`[${HELP_TARGET_ATTR}="print-bed-size"]`);
    expect(target).not.toBeNull();
    expect(target?.textContent).toBe('child');
  });

  it('forwards className to the wrapper element', () => {
    const { container } = render(
      <HelpTargetMarker id="x" className="custom-class">
        <span>child</span>
      </HelpTargetMarker>
    );
    expect(container.querySelector('.custom-class')).not.toBeNull();
  });
});
