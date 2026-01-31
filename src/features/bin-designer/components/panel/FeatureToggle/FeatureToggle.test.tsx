import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FeatureToggle } from './FeatureToggle';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('FeatureToggle', () => {
  it('renders label text', () => {
    render(<FeatureToggle label="Test Feature" checked={false} onChange={vi.fn()} />);
    expect(screen.getByText('Test Feature')).toBeInTheDocument();
  });

  it('switch shows aria-checked="true" when checked', () => {
    render(<FeatureToggle label="Test Feature" checked={true} onChange={vi.fn()} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('switch shows aria-checked="false" when unchecked', () => {
    render(<FeatureToggle label="Test Feature" checked={false} onChange={vi.fn()} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('clicking switch calls onChange', () => {
    const onChange = vi.fn();
    render(<FeatureToggle label="Test Feature" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('does not render customize section when unchecked', () => {
    render(
      <FeatureToggle label="Test Feature" checked={false} onChange={vi.fn()}>
        <div data-testid="child-controls">Controls</div>
      </FeatureToggle>
    );
    expect(screen.queryByText('binDesigner.customize')).not.toBeInTheDocument();
  });

  it('shows Customize button when checked and children provided', () => {
    render(
      <FeatureToggle label="Test Feature" checked={true} onChange={vi.fn()}>
        <div data-testid="child-controls">Controls</div>
      </FeatureToggle>
    );
    expect(screen.getByText('binDesigner.customize')).toBeInTheDocument();
  });

  it('clicking Customize reveals children, clicking Done hides them', () => {
    render(
      <FeatureToggle label="Test Feature" checked={true} onChange={vi.fn()}>
        <div data-testid="child-controls">Controls</div>
      </FeatureToggle>
    );
    // Initially the customize region exists but is aria-hidden
    const customizeBtn = screen.getByText('binDesigner.customize');
    const region = screen.getByRole('region', { hidden: true });
    expect(region).toHaveAttribute('aria-hidden', 'true');

    // Click Customize — reveals children
    fireEvent.click(customizeBtn);
    expect(region).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('common.done')).toBeInTheDocument();

    // Click Done — hides children again
    fireEvent.click(screen.getByText('common.done'));
    expect(region).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows coming soon badge and disables switch when comingSoon', () => {
    render(
      <FeatureToggle label="Test Feature" checked={false} onChange={vi.fn()} comingSoon={true} />
    );
    expect(screen.getByText('binDesigner.soon')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('disables switch and shows reason text when disabledReason is set', () => {
    render(
      <FeatureToggle
        label="Test Feature"
        checked={true}
        onChange={vi.fn()}
        disabledReason="Not available for slotted bins"
      />
    );
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Not available for slotted bins')).toBeInTheDocument();
  });

  it('hides primary controls and children when disabledReason is set', () => {
    render(
      <FeatureToggle
        label="Test Feature"
        checked={true}
        onChange={vi.fn()}
        disabledReason="Unavailable"
        primaryControls={<div>Primary</div>}
      >
        <div>Details</div>
      </FeatureToggle>
    );
    expect(screen.queryByText('Primary')).not.toBeInTheDocument();
    expect(screen.queryByText('binDesigner.customize')).not.toBeInTheDocument();
  });

  it('disabledReason takes precedence over comingSoon', () => {
    render(
      <FeatureToggle
        label="Test Feature"
        checked={false}
        onChange={vi.fn()}
        disabledReason="Style incompatible"
        comingSoon={true}
      />
    );
    expect(screen.getByText('Style incompatible')).toBeInTheDocument();
    expect(screen.queryByText('binDesigner.soon')).not.toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('shows valueSummary when checked and customize is closed', () => {
    render(
      <FeatureToggle
        label="Test Feature"
        checked={true}
        onChange={vi.fn()}
        valueSummary="6.5mm × 2mm"
      >
        <div>Controls</div>
      </FeatureToggle>
    );
    expect(screen.getByText('6.5mm × 2mm')).toBeInTheDocument();

    // Open customize — summary should be hidden
    fireEvent.click(screen.getByText('binDesigner.customize'));
    expect(screen.queryByText('6.5mm × 2mm')).not.toBeInTheDocument();
  });
});
