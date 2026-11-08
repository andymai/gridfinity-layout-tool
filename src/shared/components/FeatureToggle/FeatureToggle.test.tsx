import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FeatureToggle } from './FeatureToggle';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

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
    expect(screen.queryByText('common.customize')).not.toBeInTheDocument();
  });

  it('shows Customize button when checked and children provided', () => {
    render(
      <FeatureToggle label="Test Feature" checked={true} onChange={vi.fn()}>
        <div data-testid="child-controls">Controls</div>
      </FeatureToggle>
    );
    expect(screen.getByText('common.customize')).toBeInTheDocument();
  });

  it('clicking Customize reveals children and toggles closed again', () => {
    render(
      <FeatureToggle label="Test Feature" checked={true} onChange={vi.fn()}>
        <div data-testid="child-controls">Controls</div>
      </FeatureToggle>
    );
    const customizeBtn = screen.getByText('common.customize');
    expect(customizeBtn.closest('button')).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(customizeBtn);
    expect(customizeBtn.closest('button')).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(customizeBtn);
    expect(customizeBtn.closest('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows coming soon badge and disables switch when comingSoon', () => {
    render(
      <FeatureToggle label="Test Feature" checked={false} onChange={vi.fn()} comingSoon={true} />
    );
    expect(screen.getByText('common.soon')).toBeInTheDocument();
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
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Not available for slotted bins')).toBeInTheDocument();
  });

  it('keeps a disabled switch unchecked when the stored value is off', () => {
    render(
      <FeatureToggle
        label="Test Feature"
        checked={false}
        onChange={vi.fn()}
        disabledReason="Not available for slotted bins"
      />
    );
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('uses customizeLabel prop when provided', () => {
    render(
      <FeatureToggle label="Test Feature" checked={true} onChange={vi.fn()} customizeLabel="Adjust">
        <div>Controls</div>
      </FeatureToggle>
    );
    expect(screen.getByText('Adjust')).toBeInTheDocument();
    expect(screen.queryByText('common.customize')).not.toBeInTheDocument();
  });

  it('shows valueSummary when checked and customize is closed', () => {
    render(
      <FeatureToggle
        label="Test Feature"
        checked={true}
        onChange={vi.fn()}
        valueSummary="6.5mm x 2mm"
      >
        <div>Controls</div>
      </FeatureToggle>
    );
    expect(screen.getByText('6.5mm x 2mm')).toBeInTheDocument();

    fireEvent.click(screen.getByText('common.customize'));
    expect(screen.queryByText('6.5mm x 2mm')).not.toBeInTheDocument();
  });
  it('keeps its explanation behind an info dot until asked', () => {
    render(
      <FeatureToggle label="Test Feature" checked={false} onChange={vi.fn()} info="Explained." />
    );
    expect(screen.queryByText('Explained.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.aboutLabel' }));
    expect(screen.getByText('Explained.')).toBeInTheDocument();
  });

  it('toggles from its label text, not just the switch', () => {
    const onChange = vi.fn();
    render(<FeatureToggle label="Test Feature" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByText('Test Feature'));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('names the switch with ariaLabel when given', () => {
    render(
      <FeatureToggle
        label="Half-grid mode"
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Toggle half-grid mode"
      />
    );
    expect(screen.getByRole('switch', { name: 'Toggle half-grid mode' })).toBeInTheDocument();
  });

  it('shows the shortcut as a key cap only when given', () => {
    const { rerender } = render(
      <FeatureToggle label="Half-grid mode" checked={false} onChange={vi.fn()} shortcut="H" />
    );
    expect(screen.getByText('H').tagName).toBe('KBD');
    rerender(<FeatureToggle label="Half-grid mode" checked={false} onChange={vi.fn()} />);
    expect(screen.queryByText('H')).not.toBeInTheDocument();
  });

  it('keeps a trailing control apart from the switch', () => {
    const onChange = vi.fn();
    render(
      <FeatureToggle
        label="Custom drawer shape"
        checked={false}
        onChange={onChange}
        trailing={<button type="button">Options</button>}
      />
    );
    const trailing = screen.getByRole('button', { name: 'Options' });
    expect(screen.getByRole('switch').contains(trailing)).toBe(false);
    fireEvent.click(trailing);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('pulses the whole row on a help jump but focuses the switch', () => {
    const { container } = render(
      <FeatureToggle
        label="Half-grid mode"
        checked={false}
        onChange={vi.fn()}
        info="Explained."
        helpTarget="half-bin-mode"
      />
    );
    const row = container.querySelector('[data-help-target="half-bin-mode"]');
    expect(row).toContainElement(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toHaveAttribute('data-help-focus');
  });

  it('leaves the focus marker off when there is no help target', () => {
    render(<FeatureToggle label="Test Feature" checked={false} onChange={vi.fn()} />);
    expect(screen.getByRole('switch')).not.toHaveAttribute('data-help-focus');
  });
});
