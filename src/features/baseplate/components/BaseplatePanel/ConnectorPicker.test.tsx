import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConnectorPicker } from './ConnectorPicker';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('ConnectorPicker', () => {
  it('renders a radio for every connector style', () => {
    render(<ConnectorPicker value="none" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'baseplate.connectors.none' })).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'baseplate.connectorStyle.dovetail' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'baseplate.connectorStyle.puzzle' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'baseplate.connectorStyle.dovetailKey' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'baseplate.connectorStyle.snapClip' })
    ).toBeInTheDocument();
  });

  it('marks the active value as checked', () => {
    render(<ConnectorPicker value="dovetailKey" onChange={vi.fn()} />);
    expect(
      screen.getByRole('radio', { name: 'baseplate.connectorStyle.dovetailKey' })
    ).toBeChecked();
    expect(screen.getByRole('radio', { name: 'baseplate.connectors.none' })).not.toBeChecked();
  });

  it('calls onChange when a different option is clicked', () => {
    const onChange = vi.fn();
    render(<ConnectorPicker value="none" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'baseplate.connectorStyle.snapClip' }));
    expect(onChange).toHaveBeenCalledWith('snapClip');
  });

  it('does not call onChange when the already-selected option is clicked', () => {
    const onChange = vi.fn();
    render(<ConnectorPicker value="snapClip" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'baseplate.connectorStyle.snapClip' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses roving tabindex (only the selected radio is tabbable)', () => {
    render(<ConnectorPicker value="dovetail" onChange={vi.fn()} />);
    expect(
      screen.getByRole('radio', { name: 'baseplate.connectorStyle.dovetail' })
    ).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'baseplate.connectors.none' })).toHaveAttribute(
      'tabindex',
      '-1'
    );
  });

  it('moves selection with arrow keys', () => {
    const onChange = vi.fn();
    render(<ConnectorPicker value="none" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith('dovetail');
  });

  describe('disabledOptions', () => {
    it('renders the reason and marks the option disabled', () => {
      render(
        <ConnectorPicker
          value="none"
          onChange={vi.fn()}
          disabledOptions={{ snapClip: 'No stacking' }}
        />
      );
      const snap = screen.getByRole('radio', { name: 'baseplate.connectorStyle.snapClip' });
      expect(snap).toBeDisabled();
      expect(snap).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByText('No stacking')).toBeInTheDocument();
    });

    it('does not call onChange when a disabled option is clicked', () => {
      const onChange = vi.fn();
      render(
        <ConnectorPicker
          value="none"
          onChange={onChange}
          disabledOptions={{ snapClip: 'No stacking' }}
        />
      );
      fireEvent.click(screen.getByRole('radio', { name: 'baseplate.connectorStyle.snapClip' }));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('treats an empty-string reason as disabled (render + keyboard agree)', () => {
      const onChange = vi.fn();
      render(
        <ConnectorPicker
          value="dovetailKey"
          onChange={onChange}
          disabledOptions={{ snapClip: '' }}
        />
      );
      expect(
        screen.getByRole('radio', { name: 'baseplate.connectorStyle.snapClip' })
      ).toBeDisabled();
      fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowDown' });
      expect(onChange).toHaveBeenCalledWith('none');
    });

    it('skips disabled options in keyboard navigation', () => {
      const onChange = vi.fn();
      // From dovetailKey, ArrowDown would land on snapClip — but it's disabled,
      // so it wraps to the first selectable option instead.
      render(
        <ConnectorPicker
          value="dovetailKey"
          onChange={onChange}
          disabledOptions={{ snapClip: 'No stacking' }}
        />
      );
      fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowDown' });
      expect(onChange).toHaveBeenCalledWith('none');
    });
  });
});
