import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImportPreviewPanel } from './ImportPreviewPanel';

describe('ImportPreviewPanel', () => {
  it('renders the title and each label/value pair in order', () => {
    render(
      <ImportPreviewPanel
        title="Ready"
        rows={[
          { label: 'Name', value: 'Kitchen', emphasis: true },
          { label: 'Bins', value: 12 },
        ]}
      />
    );
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Kitchen')).toHaveClass('font-medium');
    expect(screen.getByText('12')).not.toHaveClass('font-medium');
    const cells = screen.getAllByText(/Name|Kitchen|Bins|12/).map((el) => el.textContent);
    expect(cells).toEqual(['Name', 'Kitchen', 'Bins', '12']);
  });
});
