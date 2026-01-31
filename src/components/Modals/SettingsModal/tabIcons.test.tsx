import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { GlobeIcon, BoxIcon, PlugIcon, ShieldIcon } from './tabIcons';
import { resetAllStores } from '@/test/testUtils';

describe('TabIcons', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders GlobeIcon', () => {
    const { container } = render(<GlobeIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders BoxIcon', () => {
    const { container } = render(<BoxIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders PlugIcon', () => {
    const { container } = render(<PlugIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders ShieldIcon', () => {
    const { container } = render(<ShieldIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('applies custom className to GlobeIcon', () => {
    const { container } = render(<GlobeIcon className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('applies custom className to BoxIcon', () => {
    const { container } = render(<BoxIcon className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
