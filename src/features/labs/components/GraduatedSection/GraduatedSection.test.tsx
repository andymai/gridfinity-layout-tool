import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GraduatedSection } from './GraduatedSection';
import type { FeatureFlag } from '@/core/labs';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
}));

describe('GraduatedSection', () => {
  const graduatedFeatures: FeatureFlag[] = [
    {
      id: 'feature-1',
      name: 'Feature One',
      description: 'First graduated feature',
      status: 'graduated',
      risk: 'low',
    },
    {
      id: 'feature-2',
      name: 'Feature Two',
      description: 'Second graduated feature',
      status: 'graduated',
      risk: 'low',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when features list is empty', () => {
    const { container } = render(<GraduatedSection features={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders collapsed by default', () => {
    render(<GraduatedSection features={graduatedFeatures} />);

    expect(screen.queryByText('Feature One')).not.toBeInTheDocument();
    expect(screen.queryByText('Feature Two')).not.toBeInTheDocument();
  });

  it('shows feature count in collapsed state', () => {
    render(<GraduatedSection features={graduatedFeatures} />);
    expect(screen.getByText(/labs.whatsNew/)).toBeInTheDocument();
  });

  it('expands when clicked', () => {
    render(<GraduatedSection features={graduatedFeatures} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByText('Feature One')).toBeInTheDocument();
    expect(screen.getByText('Feature Two')).toBeInTheDocument();
  });

  it('collapses when clicked again', () => {
    render(<GraduatedSection features={graduatedFeatures} />);

    const button = screen.getByRole('button');

    // Expand
    fireEvent.click(button);
    expect(screen.getByText('Feature One')).toBeInTheDocument();

    // Collapse
    fireEvent.click(button);
    expect(screen.queryByText('Feature One')).not.toBeInTheDocument();
  });

  it('shows now available message for each feature', () => {
    render(<GraduatedSection features={graduatedFeatures} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    const availableMessages = screen.getAllByText('labs.nowAvailableToEveryone');
    expect(availableMessages).toHaveLength(2);
  });

  it('updates aria-expanded attribute', () => {
    render(<GraduatedSection features={graduatedFeatures} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders all graduated features', () => {
    render(<GraduatedSection features={graduatedFeatures} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    graduatedFeatures.forEach((feature) => {
      expect(screen.getByText(feature.name)).toBeInTheDocument();
    });
  });
});
