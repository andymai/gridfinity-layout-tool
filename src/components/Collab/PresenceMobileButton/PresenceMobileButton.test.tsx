import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresenceMobileButton } from './PresenceMobileButton';
import { resetAllStores } from '@/test/testUtils';

// Mock child component
vi.mock('../ConnectionIndicator', () => ({
  ConnectionIndicator: () => <div data-testid="connection-indicator" />,
}));

// Mock translation
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (key === 'collab.mobileButton.ariaLabel') {
      return `${params?.count || 0} collaborators`;
    }
    if (key === 'collab.mobileButton.title') {
      return `View ${params?.count || 0} collaborators`;
    }
    return key;
  },
}));

describe('PresenceMobileButton', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const onPress = vi.fn();
    render(<PresenceMobileButton participantCount={2} status="connected" onPress={onPress} />);
  });

  it('displays participant count', () => {
    const onPress = vi.fn();
    render(<PresenceMobileButton participantCount={5} status="connected" onPress={onPress} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('displays people emoji', () => {
    const onPress = vi.fn();
    render(<PresenceMobileButton participantCount={2} status="connected" onPress={onPress} />);
    expect(screen.getByText('👥')).toBeInTheDocument();
  });

  it('displays connection indicator', () => {
    const onPress = vi.fn();
    render(<PresenceMobileButton participantCount={2} status="connected" onPress={onPress} />);
    expect(screen.getByTestId('connection-indicator')).toBeInTheDocument();
  });

  it('calls onPress when clicked', () => {
    const onPress = vi.fn();
    render(<PresenceMobileButton participantCount={2} status="connected" onPress={onPress} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    const onPress = vi.fn();
    const { container } = render(
      <PresenceMobileButton
        participantCount={2}
        status="connected"
        onPress={onPress}
        className="custom-class"
      />
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    const onPress = vi.fn();
    render(<PresenceMobileButton participantCount={3} status="connected" onPress={onPress} />);
    expect(screen.getByLabelText('3 collaborators')).toBeInTheDocument();
  });

  it('has correct title attribute', () => {
    const onPress = vi.fn();
    render(<PresenceMobileButton participantCount={3} status="connected" onPress={onPress} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'View 3 collaborators');
  });
});
