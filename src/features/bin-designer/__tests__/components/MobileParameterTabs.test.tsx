import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileParameterTabs } from '../../components/MobileParameterTabs';
import { useDesignerStore } from '../../store';
import { DEFAULT_BIN_PARAMS } from '../../constants';

describe('MobileParameterTabs', () => {
  beforeEach(() => {
    localStorage.clear();
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
    });
  });

  it('renders all 4 tabs', () => {
    render(<MobileParameterTabs />);

    expect(screen.getByRole('tab', { name: /shape/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /base/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /features/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /presets/i })).toBeInTheDocument();
  });

  it('defaults to Shape tab active', () => {
    render(<MobileParameterTabs />);

    const shapeTab = screen.getByRole('tab', { name: /shape/i });
    expect(shapeTab).toHaveAttribute('aria-selected', 'true');
  });

  it('shows Shape panel content by default', () => {
    render(<MobileParameterTabs />);

    // Shape tab shows DimensionsSection (has Width/Depth/Height inputs)
    expect(screen.getByLabelText('Width')).toBeInTheDocument();
    expect(screen.getByLabelText('Depth')).toBeInTheDocument();
  });

  it('switching to Base tab shows base content', () => {
    render(<MobileParameterTabs />);

    fireEvent.click(screen.getByRole('tab', { name: /base/i }));

    const baseTab = screen.getByRole('tab', { name: /base/i });
    expect(baseTab).toHaveAttribute('aria-selected', 'true');

    // Base panel has BaseSection (base style options)
    expect(screen.getByText(/Stacking Lip/i)).toBeInTheDocument();
  });

  it('switching to Features tab shows features content', () => {
    render(<MobileParameterTabs />);

    fireEvent.click(screen.getByRole('tab', { name: /features/i }));

    // Features panel has FeaturesSection (scoop, dividers, label)
    expect(screen.getByText(/Scoop/i)).toBeInTheDocument();
  });

  it('switching to Presets tab shows preset buttons', () => {
    render(<MobileParameterTabs />);

    fireEvent.click(screen.getByRole('tab', { name: /presets/i }));

    // Presets panel has PresetSelector with built-in presets
    expect(screen.getByLabelText('Apply Heavy Duty preset')).toBeInTheDocument();
  });

  it('has accessible tablist role', () => {
    render(<MobileParameterTabs />);

    expect(screen.getByRole('tablist', { name: /parameter sections/i })).toBeInTheDocument();
  });

  it('tab panels have proper ARIA attributes', () => {
    render(<MobileParameterTabs />);

    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'panel-shape');
  });

  it('hides inactive panels', () => {
    render(<MobileParameterTabs />);

    // Base panel should be hidden
    const basePanel = document.getElementById('panel-base');
    expect(basePanel).toHaveAttribute('hidden');
  });

  it('tabs have minimum 44px height for touch targets', () => {
    render(<MobileParameterTabs />);

    const shapeTab = screen.getByRole('tab', { name: /shape/i });
    expect(shapeTab).toHaveStyle({ minHeight: '44px' });
  });
});
