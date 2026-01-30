import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeatureStatusBadge } from '.';

describe('FeatureStatusBadge', () => {
  it('renders experimental status', () => {
    render(<FeatureStatusBadge status="experimental" />);
    expect(screen.getByText('Experimental')).toBeDefined();
    expect(screen.getByLabelText('Status: Experimental')).toBeDefined();
  });

  it('renders preview status', () => {
    render(<FeatureStatusBadge status="preview" />);
    expect(screen.getByText('Preview')).toBeDefined();
  });

  it('renders graduated status', () => {
    render(<FeatureStatusBadge status="graduated" />);
    expect(screen.getByText('Graduated')).toBeDefined();
  });

  it('renders deprecated status', () => {
    render(<FeatureStatusBadge status="deprecated" />);
    expect(screen.getByText('Deprecated')).toBeDefined();
  });
});
