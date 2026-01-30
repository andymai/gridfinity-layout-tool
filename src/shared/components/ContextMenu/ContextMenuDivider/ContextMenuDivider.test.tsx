import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ContextMenuDivider } from './ContextMenuDivider';

describe('ContextMenuDivider', () => {
  it('renders a divider element', () => {
    const { container } = render(<ContextMenuDivider />);
    const divider = container.firstChild;
    expect(divider).toBeInTheDocument();
    expect(divider).toHaveClass('border-t');
  });
});
