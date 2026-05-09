import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteAccountDialog } from './DeleteAccountDialog';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}::${JSON.stringify(params)}` : key,
}));

describe('DeleteAccountDialog', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <DeleteAccountDialog isOpen={false} localCount={3} onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('clicking the destructive Delete emits onConfirm', () => {
    const onConfirm = vi.fn();
    render(
      <DeleteAccountDialog isOpen={true} localCount={3} onConfirm={onConfirm} onCancel={vi.fn()} />
    );
    fireEvent.click(screen.getByText('syncDialog.deleteAccount.confirm'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('clicking Cancel emits onCancel (not onConfirm)', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <DeleteAccountDialog isOpen={true} localCount={3} onConfirm={onConfirm} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByText('common.cancel'));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('passes localCount to the local-data note', () => {
    render(
      <DeleteAccountDialog isOpen={true} localCount={5} onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText(/"count":5/)).toBeInTheDocument();
  });
});
