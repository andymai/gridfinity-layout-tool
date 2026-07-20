// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DesignTagChips } from './DesignTagChips';
import { useTagAppearanceStore } from '../../store/tagAppearance';

beforeEach(() => {
  useTagAppearanceStore.setState({ appearances: {} });
});

describe('DesignTagChips', () => {
  it('renders nothing when there are no tags', () => {
    const { container } = render(<DesignTagChips tags={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders each tag as a chip', () => {
    render(<DesignTagChips tags={['kitchen', 'screws']} />);
    expect(screen.getByText('kitchen')).toBeInTheDocument();
    expect(screen.getByText('screws')).toBeInTheDocument();
  });

  it('caps visible chips and shows a +N overflow', () => {
    render(<DesignTagChips tags={['a', 'b', 'c', 'd', 'e']} max={3} />);
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('c')).toBeInTheDocument();
    expect(screen.queryByText('d')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('shows a tag icon and color tint when an appearance is set', () => {
    useTagAppearanceStore.setState({
      appearances: { kitchen: { icon: '🔧', color: '#f87171' } },
    });
    render(<DesignTagChips tags={['Kitchen']} />);
    expect(screen.getByText('🔧')).toBeInTheDocument();
    const chip = screen.getByTitle('Kitchen');
    expect(chip.getAttribute('style')).toContain('background-color');
  });
});
