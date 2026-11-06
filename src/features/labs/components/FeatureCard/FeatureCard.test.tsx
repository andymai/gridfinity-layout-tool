import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeatureCard } from './FeatureCard';
import type { FeatureFlag } from '@/core/labs';

vi.mock('../icons', () => ({
  SparklesIcon: ({ className }: { className?: string }) => (
    <div className={className}>Sparkles</div>
  ),
  InfoIcon: ({ className }: { className?: string }) => <div className={className}>Info</div>,
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
}));

describe('FeatureCard', () => {
  const baseFeature: FeatureFlag = {
    id: 'test-feature',
    name: 'Test Feature',
    description: 'Test feature description',
    risk: 'low',
  };

  const mockToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders feature name and description', () => {
    render(<FeatureCard feature={baseFeature} isEnabled={false} onToggle={mockToggle} />);

    expect(screen.getByText('Test Feature')).toBeInTheDocument();
    expect(screen.getByText('Test feature description')).toBeInTheDocument();
  });

  it('marks the feature as early access', () => {
    render(<FeatureCard feature={baseFeature} isEnabled={false} onToggle={mockToggle} />);
    expect(screen.getByText('labs.earlyAccess')).toBeInTheDocument();
  });

  it('renders toggle switch for experimental features', () => {
    render(<FeatureCard feature={baseFeature} isEnabled={false} onToggle={mockToggle} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeChecked();
  });

  it('calls onToggle when switch is clicked', () => {
    render(<FeatureCard feature={baseFeature} isEnabled={false} onToggle={mockToggle} />);

    fireEvent.click(screen.getByRole('switch'));

    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('shows enabled state on toggle', () => {
    render(<FeatureCard feature={baseFeature} isEnabled onToggle={mockToggle} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeChecked();
  });

  it('shows warning for medium risk features', () => {
    const mediumRiskFeature = {
      ...baseFeature,
      risk: 'medium' as const,
      warning: 'This might cause issues',
    };

    render(<FeatureCard feature={mediumRiskFeature} isEnabled={false} onToggle={mockToggle} />);
    expect(screen.getByText('This might cause issues')).toBeInTheDocument();
  });

  it('shows warning for high risk features', () => {
    const highRiskFeature = {
      ...baseFeature,
      risk: 'high' as const,
      warning: 'This is dangerous',
    };

    render(<FeatureCard feature={highRiskFeature} isEnabled={false} onToggle={mockToggle} />);
    expect(screen.getByText('This is dangerous')).toBeInTheDocument();
  });
});
