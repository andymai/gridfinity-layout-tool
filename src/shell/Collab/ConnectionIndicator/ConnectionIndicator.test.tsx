import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionIndicator } from './ConnectionIndicator';
import { resetAllStores } from '@/test/testUtils';

// Mock translation
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => {
    const translations: Record<string, string> = {
      'collab.connected': 'Connected',
      'collab.reconnecting': 'Reconnecting',
      'collab.connecting': 'Connecting',
      'collab.disconnected': 'Disconnected',
    };
    return translations[key] || key;
  },
}));

describe('ConnectionIndicator', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<ConnectionIndicator status="connected" />);
  });

  it('renders connected status', () => {
    render(<ConnectionIndicator status="connected" />);
    expect(screen.getByRole('status', { name: 'Connected' })).toBeInTheDocument();
  });

  it('renders reconnecting status', () => {
    render(<ConnectionIndicator status="reconnecting" />);
    expect(screen.getByRole('status', { name: 'Reconnecting' })).toBeInTheDocument();
  });

  it('renders connecting status', () => {
    render(<ConnectionIndicator status="connecting" />);
    expect(screen.getByRole('status', { name: 'Connecting' })).toBeInTheDocument();
  });

  it('renders disconnected status', () => {
    render(<ConnectionIndicator status="disconnected" />);
    expect(screen.getByRole('status', { name: 'Disconnected' })).toBeInTheDocument();
  });

  it('renders small size by default', () => {
    const { container } = render(<ConnectionIndicator status="connected" />);
    const indicator = container.querySelector('[role="status"]');
    expect(indicator).toHaveClass('w-2', 'h-2');
  });

  it('renders medium size when specified', () => {
    const { container } = render(<ConnectionIndicator status="connected" size="md" />);
    const indicator = container.querySelector('[role="status"]');
    expect(indicator).toHaveClass('w-2.5', 'h-2.5');
  });

  it('applies custom className', () => {
    const { container } = render(
      <ConnectionIndicator status="connected" className="custom-class" />
    );
    const indicator = container.querySelector('[role="status"]');
    expect(indicator).toHaveClass('custom-class');
  });

  it('has pulse animation for reconnecting status', () => {
    const { container } = render(<ConnectionIndicator status="reconnecting" />);
    const indicator = container.querySelector('[role="status"]');
    expect(indicator).toHaveClass('animate-pulse');
  });

  it('has pulse animation for connecting status', () => {
    const { container } = render(<ConnectionIndicator status="connecting" />);
    const indicator = container.querySelector('[role="status"]');
    expect(indicator).toHaveClass('animate-pulse');
  });

  it('does not have pulse animation for connected status', () => {
    const { container } = render(<ConnectionIndicator status="connected" />);
    const indicator = container.querySelector('[role="status"]');
    expect(indicator).not.toHaveClass('animate-pulse');
  });

  it('does not have pulse animation for disconnected status', () => {
    const { container } = render(<ConnectionIndicator status="disconnected" />);
    const indicator = container.querySelector('[role="status"]');
    expect(indicator).not.toHaveClass('animate-pulse');
  });

  it('has title attribute for accessibility', () => {
    render(<ConnectionIndicator status="connected" />);
    const indicator = screen.getByRole('status', { name: 'Connected' });
    expect(indicator).toHaveAttribute('title', 'Connected');
  });
});
