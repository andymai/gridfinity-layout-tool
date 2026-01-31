import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeatureCard } from './FeatureCard';
import type { FeatureFlag } from '@/core/labs';

vi.mock('../FeatureStatusBadge', () => ({
  FeatureStatusBadge: ({ status }: { status: string }) => <div>Status: {status}</div>,
}));

vi.mock('../icons', () => ({
  SparklesIcon: ({ className }: { className?: string }) => (
    <div className={className}>Sparkles</div>
  ),
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
    status: 'experimental',
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

  it('shows status badge', () => {
    render(<FeatureCard feature={baseFeature} isEnabled={false} onToggle={mockToggle} />);
    expect(screen.getByText('Status: experimental')).toBeInTheDocument();
  });

  it('shows coming soon badge for coming soon features', () => {
    const comingSoonFeature = { ...baseFeature, comingSoon: true };
    render(<FeatureCard feature={comingSoonFeature} isEnabled={false} onToggle={mockToggle} />);

    expect(screen.getByText('labs.comingSoon')).toBeInTheDocument();
    expect(screen.getByText('labs.inDevelopment')).toBeInTheDocument();
  });

  it('renders toggle switch for experimental features', () => {
    render(<FeatureCard feature={baseFeature} isEnabled={false} onToggle={mockToggle} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onToggle when switch is clicked', () => {
    render(<FeatureCard feature={baseFeature} isEnabled={false} onToggle={mockToggle} />);

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('shows enabled state on toggle', () => {
    render(<FeatureCard feature={baseFeature} isEnabled onToggle={mockToggle} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
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

  it('shows learn more link when URL is provided', () => {
    const featureWithLink = { ...baseFeature, learnMoreUrl: 'https://example.com' };
    render(<FeatureCard feature={featureWithLink} isEnabled={false} onToggle={mockToggle} />);

    const link = screen.getByText('labs.learnMore');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'https://example.com');
  });

  it('shows always on indicator for graduated features', () => {
    const graduatedFeature = { ...baseFeature, status: 'graduated' as const };
    render(<FeatureCard feature={graduatedFeature} isEnabled={true} onToggle={mockToggle} />);

    expect(screen.getByText('labs.alwaysOn')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('does not show toggle for deprecated features', () => {
    const deprecatedFeature = { ...baseFeature, status: 'deprecated' as const };
    render(<FeatureCard feature={deprecatedFeature} isEnabled={false} onToggle={mockToggle} />);

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('applies reduced opacity for coming soon features', () => {
    const comingSoonFeature = { ...baseFeature, comingSoon: true };
    const { container } = render(
      <FeatureCard feature={comingSoonFeature} isEnabled={false} onToggle={mockToggle} />
    );

    const article = container.querySelector('article');
    expect(article).toHaveClass('opacity-75');
  });
});
