import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LabsTab } from './LabsTab';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('zustand/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}));

vi.mock('@/core/store', () => ({
  useLabsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      toggleFeature: vi.fn(),
      isFeatureEnabled: () => false,
    }),
}));

vi.mock('@/core/labs', () => ({
  getToggleableFeatures: () => [
    {
      id: 'binDesigner',
      titleKey: 'labs.binDesigner.title',
      descriptionKey: 'labs.binDesigner.desc',
    },
  ],
  getGraduatedFeatures: () => [],
}));

vi.mock('@/features/labs/components/FeatureCard', () => ({
  FeatureCard: ({ feature }: { feature: { titleKey: string } }) => (
    <div data-testid="feature-card">{feature.titleKey}</div>
  ),
}));

vi.mock('@/features/labs/components/GraduatedSection', () => ({
  GraduatedSection: () => <div data-testid="graduated-section">Graduated</div>,
}));

vi.mock('@/features/labs/components/icons', () => ({
  SparklesIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="sparkles-icon" />
  ),
}));

describe('LabsTab', () => {
  it('renders labs heading', () => {
    render(<LabsTab />);
    expect(screen.getByText('settings.labs')).toBeInTheDocument();
  });

  it('renders feature cards', () => {
    render(<LabsTab />);
    expect(screen.getByTestId('feature-card')).toBeInTheDocument();
  });
});
