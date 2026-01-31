import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { BinDesignThumbnail } from './BinDesignThumbnail';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('BinDesignThumbnail', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing with default params', () => {
    const { container } = render(<BinDesignThumbnail params={DEFAULT_BIN_PARAMS} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders with custom size', () => {
    const { container } = render(<BinDesignThumbnail params={DEFAULT_BIN_PARAMS} size={64} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders with custom className', () => {
    const { container } = render(
      <BinDesignThumbnail params={DEFAULT_BIN_PARAMS} className="custom-class" />
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('custom-class');
  });

  it('renders bin with compartments', () => {
    const params = {
      ...DEFAULT_BIN_PARAMS,
      compartments: {
        cols: 2,
        rows: 2,
        thickness: 1.2,
        cells: [0, 1, 2, 3],
      },
    };
    const { container } = render(<BinDesignThumbnail params={params} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders bin with different dimensions', () => {
    const params = {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 4,
      height: 5,
    };
    const { container } = render(<BinDesignThumbnail params={params} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders bin with merged compartments', () => {
    const params = {
      ...DEFAULT_BIN_PARAMS,
      compartments: {
        cols: 2,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 1, 1], // Two merged compartments
      },
    };
    const { container } = render(<BinDesignThumbnail params={params} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
