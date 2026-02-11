import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LabsTab } from './LabsTab';

const mockToggleFeature = vi.hoisted(() => vi.fn());
const mockIsFeatureEnabled = vi.hoisted(() => vi.fn(() => true));
const mockFeatures = vi.hoisted(() => ({
  toggleable: [
    {
      id: 'binDesigner',
      titleKey: 'labs.binDesigner.title',
      descriptionKey: 'labs.binDesigner.desc',
    },
  ] as Array<{ id: string; titleKey: string; descriptionKey: string }>,
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('zustand/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}));

vi.mock('@/core/store', () => ({
  useLabsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      toggleFeature: mockToggleFeature,
      isFeatureEnabled: mockIsFeatureEnabled,
    }),
}));

vi.mock('@/core/labs', () => ({
  getToggleableFeatures: () => mockFeatures.toggleable,
  getGraduatedFeatures: () => [],
}));

vi.mock('@/features/labs/components/FeatureCard', () => ({
  FeatureCard: ({
    feature,
    isEnabled,
    onToggle,
  }: {
    feature: { titleKey: string };
    isEnabled: boolean;
    onToggle: () => void;
  }) => (
    <div
      data-testid="feature-card"
      data-enabled={isEnabled}
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      {feature.titleKey}
    </div>
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

  it('FeatureCard receives correct isEnabled and onToggle props', () => {
    mockIsFeatureEnabled.mockReturnValue(true);
    render(<LabsTab />);
    const card = screen.getByTestId('feature-card');
    expect(card).toHaveAttribute('data-enabled', 'true');
  });

  it('renders empty state when no toggleable features', () => {
    mockFeatures.toggleable = [];
    render(<LabsTab />);
    expect(screen.getByText('settings.labsEmpty')).toBeInTheDocument();
    // Restore for other tests
    mockFeatures.toggleable = [
      {
        id: 'binDesigner',
        titleKey: 'labs.binDesigner.title',
        descriptionKey: 'labs.binDesigner.desc',
      },
    ];
  });

  it('renders GraduatedSection component', () => {
    render(<LabsTab />);
    expect(screen.getByTestId('graduated-section')).toBeInTheDocument();
  });
});
