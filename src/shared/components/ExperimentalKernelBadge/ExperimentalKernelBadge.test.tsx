import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLabsStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import { ExperimentalKernelBadge } from './ExperimentalKernelBadge';

function enableBrepkit() {
  useLabsStore.setState({
    preferences: {
      ...useLabsStore.getState().preferences,
      enabledFeatures: { brepkit_kernel: true },
    },
  });
}

function disableBrepkit() {
  useLabsStore.setState({
    preferences: {
      ...useLabsStore.getState().preferences,
      enabledFeatures: {},
    },
  });
}

describe('ExperimentalKernelBadge', () => {
  beforeEach(() => {
    resetAllStores();
    disableBrepkit();
  });

  it('renders nothing when brepkit flag is disabled', () => {
    const { container } = render(<ExperimentalKernelBadge />);
    expect(container.firstChild).toBeNull();
  });

  it('renders badge when brepkit flag is enabled', () => {
    enableBrepkit();
    render(<ExperimentalKernelBadge />);
    expect(screen.getByText(/alternative 3d engine/i)).toBeInTheDocument();
    expect(screen.getByText(/geometry defects/i)).toBeInTheDocument();
  });

  it('renders a Labs settings link that opens the Labs tab', async () => {
    const user = userEvent.setup();
    enableBrepkit();
    render(<ExperimentalKernelBadge />);

    const link = screen.getByRole('button', { name: /labs settings/i });
    expect(link).toBeInTheDocument();

    const opened = vi.fn();
    window.addEventListener('open-settings-modal', opened);
    await user.click(link);
    window.removeEventListener('open-settings-modal', opened);

    expect((opened.mock.calls[0][0] as CustomEvent).detail).toEqual({ tab: 'labs' });
  });
});
