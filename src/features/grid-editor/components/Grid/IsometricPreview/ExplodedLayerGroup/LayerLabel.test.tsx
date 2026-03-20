import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { layerId } from '@/core/types';

// Mock drei's Html to render children directly (avoids Canvas requirement)
vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { LayerLabel } from './LayerLabel';

describe('LayerLabel', () => {
  const defaultProps = {
    layerId: layerId('layer-1'),
    layerName: 'Bottom',
    layerHeightMm: 21,
    isActive: false,
    drawerWidth: 6,
    layerCenterZ: 0.5,
    onLayerClick: vi.fn(),
  };

  it('renders layer name and height', () => {
    render(<LayerLabel {...defaultProps} />);
    expect(screen.getByRole('button')).toHaveTextContent('Bottom · 21mm');
  });

  it('calls onLayerClick with layer id when clicked', () => {
    const onLayerClick = vi.fn();
    render(<LayerLabel {...defaultProps} onLayerClick={onLayerClick} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onLayerClick).toHaveBeenCalledTimes(1);
    expect(onLayerClick).toHaveBeenCalledWith(layerId('layer-1'));
  });

  it('applies active styling when isActive is true', () => {
    render(<LayerLabel {...defaultProps} isActive={true} />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-accent');
  });

  it('applies inactive styling when isActive is false', () => {
    render(<LayerLabel {...defaultProps} isActive={false} />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-surface-elevated');
  });
});
