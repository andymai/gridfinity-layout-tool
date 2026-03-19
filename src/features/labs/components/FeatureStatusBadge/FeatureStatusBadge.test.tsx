import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeatureStatusBadge } from '.';

describe('FeatureStatusBadge', () => {
  it('renders experimental status', () => {
    render(<FeatureStatusBadge status="experimental" />);
    expect(screen.getByText('Early access')).toBeDefined();
    expect(screen.getByLabelText('Status: Early access')).toBeDefined();
  });

  it('renders preview status', () => {
    render(<FeatureStatusBadge status="preview" />);
    expect(screen.getByText('Beta')).toBeDefined();
  });

  it('renders graduated status', () => {
    render(<FeatureStatusBadge status="graduated" />);
    expect(screen.getByText('Shipped')).toBeDefined();
  });

  it('renders deprecated status', () => {
    render(<FeatureStatusBadge status="deprecated" />);
    expect(screen.getByText('Retiring')).toBeDefined();
  });
});
