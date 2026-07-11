import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteBaseplateWarningDialog } from './DeleteBaseplateWarningDialog';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

describe('DeleteBaseplateWarningDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('does not render when closed', () => {
    render(
      <DeleteBaseplateWarningDialog
        isOpen={false}
        designName="Baseplate 1"
        affectedCount={0}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('renders the design name and affected-layout count when open', () => {
    render(
      <DeleteBaseplateWarningDialog
        isOpen
        designName="My Baseplate"
        affectedCount={3}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('My Baseplate')).toBeInTheDocument();
    expect(
      screen.getByText(/baseplate\.library\.deleteWarning\.affectedCount:{"count":3}/)
    ).toBeInTheDocument();
  });

  it('calls onConfirm when the delete button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <DeleteBaseplateWarningDialog
        isOpen
        designName="My Baseplate"
        affectedCount={1}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('baseplate.library.deleteWarning.confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <DeleteBaseplateWarningDialog
        isOpen
        designName="My Baseplate"
        affectedCount={0}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText('common.cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
