import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LinkIcon, ChevronIcon } from './icons';

describe('panel icons', () => {
  it('rotates the chevron when open', () => {
    const { container } = render(<ChevronIcon open />);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('rotate-90');
  });

  it('renders the link icon in both states', () => {
    const linked = render(<LinkIcon linked />);
    expect(linked.container.querySelector('svg')).not.toBeNull();
    const unlinked = render(<LinkIcon linked={false} />);
    // Broken-link state adds the strike-through line.
    expect(unlinked.container.querySelector('line')).not.toBeNull();
  });
});
