import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignOutDialog } from './SignOutDialog';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}::${JSON.stringify(params)}` : key,
}));

describe('SignOutDialog', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <SignOutDialog isOpen={false} localCount={3} onChoice={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('clicking Keep emits onChoice("keep")', () => {
    const onChoice = vi.fn();
    render(<SignOutDialog isOpen={true} localCount={3} onChoice={onChoice} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('syncDialog.signOut.keep'));
    expect(onChoice).toHaveBeenCalledWith('keep');
  });

  it('clicking Wipe emits onChoice("wipe")', () => {
    const onChoice = vi.fn();
    render(<SignOutDialog isOpen={true} localCount={3} onChoice={onChoice} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('syncDialog.signOut.wipe'));
    expect(onChoice).toHaveBeenCalledWith('wipe');
  });

  it('clicking Cancel emits onCancel (not onChoice)', () => {
    const onChoice = vi.fn();
    const onCancel = vi.fn();
    render(<SignOutDialog isOpen={true} localCount={3} onChoice={onChoice} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('common.cancel'));
    expect(onCancel).toHaveBeenCalled();
    expect(onChoice).not.toHaveBeenCalled();
  });

  it('passes localCount to the message', () => {
    render(<SignOutDialog isOpen={true} localCount={5} onChoice={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/"count":5/)).toBeInTheDocument();
  });
});
