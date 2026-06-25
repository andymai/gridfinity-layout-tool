import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DividerSelectionEditor } from './DividerSelectionEditor';

describe('DividerSelectionEditor', () => {
  it('renders a jump-to-editor action for the selected divider', () => {
    render(<DividerSelectionEditor />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
