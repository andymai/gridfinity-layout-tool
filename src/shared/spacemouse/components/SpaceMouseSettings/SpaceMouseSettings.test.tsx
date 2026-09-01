import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../constants';
import { useSpaceMouseStore } from '../../settingsStore';
import { SpaceMouseSettings } from './SpaceMouseSettings';

const h = vi.hoisted(() => ({
  supported: true,
  requestPairing: vi.fn(),
}));

vi.mock('../../deviceManager', () => ({
  isWebHidSupported: () => h.supported,
  requestSpaceMousePairing: h.requestPairing,
}));

beforeEach(() => {
  h.supported = true;
  useSpaceMouseStore.setState({
    settings: DEFAULT_SETTINGS,
    status: 'idle',
    deviceName: null,
    transport: 'webhid',
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('SpaceMouseSettings', () => {
  it('shows the idle status and a Connect button, and pairs on click', () => {
    render(<SpaceMouseSettings />);
    expect(screen.getByText('No device connected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(h.requestPairing).toHaveBeenCalledTimes(1);
  });

  it('shows the connected device name', () => {
    useSpaceMouseStore.setState({ status: 'connected', deviceName: 'SpaceMouse Pro' });
    render(<SpaceMouseSettings />);
    expect(screen.getByText('Connected: SpaceMouse Pro')).toBeInTheDocument();
  });

  it('hides the Connect button on unsupported browsers', () => {
    h.supported = false;
    render(<SpaceMouseSettings />);
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
  });

  it('toggles a per-axis invert switch through the store', () => {
    render(<SpaceMouseSettings />);
    expect(useSpaceMouseStore.getState().settings.invert.panX).toBe(false);
    fireEvent.click(screen.getByRole('switch', { name: 'Pan horizontal' }));
    expect(useSpaceMouseStore.getState().settings.invert.panX).toBe(true);
  });

  it('resets tuning to defaults', () => {
    useSpaceMouseStore.getState().setSensitivity(3);
    render(<SpaceMouseSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(useSpaceMouseStore.getState().settings.sensitivity).toBe(DEFAULT_SETTINGS.sensitivity);
  });

  it('hides in-app tuning in driver mode, deferring to the control panel', () => {
    useSpaceMouseStore.setState({
      status: 'connected',
      deviceName: '3Dconnexion driver',
      transport: 'navlib',
    });
    render(<SpaceMouseSettings />);
    expect(
      screen.getByText('Speed and axis direction are set in the 3Dconnexion control panel.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Pan horizontal' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
  });
});
