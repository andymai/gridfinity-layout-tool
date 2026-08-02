import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog } from '@/design-system';
import { IdentityStep } from './IdentityStep';

function renderStep(initialName = '') {
  const onContinue = vi.fn();
  render(
    <Dialog.Root open onClose={() => undefined}>
      <IdentityStep initialName={initialName} onContinue={onContinue} />
    </Dialog.Root>
  );
  return onContinue;
}

describe('IdentityStep', () => {
  it('disables Continue until a name is entered', () => {
    const onContinue = renderStep();
    expect(screen.getByText('Continue')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Public name'), { target: { value: 'BinCrafter' } });
    fireEvent.click(screen.getByText('Continue'));
    expect(onContinue).toHaveBeenCalledWith('BinCrafter');
  });

  it('prefills from the provided initial name', () => {
    renderStep('octo-andy');
    expect(screen.getByLabelText('Public name')).toHaveValue('octo-andy');
  });

  it('shows the persistent CC BY 4.0 disclosure with a terms link', () => {
    renderStep();
    expect(screen.getByText(/anyone can remix them under CC BY 4\.0/)).toBeInTheDocument();
    expect(screen.getByText('Terms of use')).toHaveAttribute('href', '/terms');
  });
});
