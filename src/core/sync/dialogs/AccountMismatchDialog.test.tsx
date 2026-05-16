import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountMismatchDialog } from './AccountMismatchDialog';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}::${JSON.stringify(params)}` : key,
}));

describe('AccountMismatchDialog', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <AccountMismatchDialog
        isOpen={false}
        localCount={3}
        newAccountLabel="a@example.com"
        onChoice={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('clicking Discard emits onChoice("discard")', () => {
    const onChoice = vi.fn();
    render(
      <AccountMismatchDialog
        isOpen={true}
        localCount={3}
        newAccountLabel="a@example.com"
        onChoice={onChoice}
      />
    );
    fireEvent.click(screen.getByText('syncDialog.accountMismatch.discard'));
    expect(onChoice).toHaveBeenCalledWith('discard');
  });

  it('clicking Merge emits onChoice("merge") with the account label substituted', () => {
    const onChoice = vi.fn();
    render(
      <AccountMismatchDialog
        isOpen={true}
        localCount={3}
        newAccountLabel="a@example.com"
        onChoice={onChoice}
      />
    );
    fireEvent.click(screen.getByText(/syncDialog\.accountMismatch\.merge/));
    expect(onChoice).toHaveBeenCalledWith('merge');
  });

  it('Escape key does not trigger discard or merge (no-op onClose)', () => {
    const onChoice = vi.fn();
    render(
      <AccountMismatchDialog
        isOpen={true}
        localCount={3}
        newAccountLabel="a@example.com"
        onChoice={onChoice}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onChoice).not.toHaveBeenCalled();
  });

  it('makes the non-destructive Merge button the primary action', () => {
    // A reflex Enter on dialog open must not fire the destructive discard.
    render(
      <AccountMismatchDialog
        isOpen={true}
        localCount={3}
        newAccountLabel="a@example.com"
        onChoice={vi.fn()}
      />
    );
    const merge = screen.getByText(/syncDialog\.accountMismatch\.merge/).closest('button');
    const discard = screen.getByText('syncDialog.accountMismatch.discard').closest('button');
    expect(merge?.className).toMatch(/from-accent/);
    expect(discard?.className).toMatch(/to-danger/);
  });

  it('passes count and account to the message body', () => {
    render(
      <AccountMismatchDialog
        isOpen={true}
        localCount={7}
        newAccountLabel="b@example.com"
        onChoice={vi.fn()}
      />
    );
    expect(
      screen.getByText(
        /syncDialog\.accountMismatch\.message::.*"count":7.*"account":"b@example\.com"/
      )
    ).toBeInTheDocument();
  });
});
