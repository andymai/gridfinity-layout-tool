import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LabsDrawer } from './LabsDrawer';
import { resetAllStores } from '@/test/testUtils';
import type { FeatureFlag } from '@/core/labs';
import { useLabsStore } from '@/core/store';
import { getToggleableFeatures } from '@/core/labs';

// Mock stores
vi.mock('@/core/store');

// Mock feature retrieval
const mockToggleableFeatures: FeatureFlag[] = [
  {
    id: 'feature-1',
    name: 'Test Feature 1',
    description: 'First test feature',
    status: 'experimental',
    risk: 'low',
  },
  {
    id: 'feature-2',
    name: 'Test Feature 2',
    description: 'Second test feature',
    status: 'preview',
    risk: 'medium',
  },
];

vi.mock('@/core/labs', () => ({
  getToggleableFeatures: vi.fn(() => mockToggleableFeatures),
  getGraduatedFeatures: vi.fn(() => []),
  createDefaultLabsPreferences: vi.fn(() => ({
    enabledFeatures: {},
  })),
}));

vi.mock('../FeatureCard', () => ({
  FeatureCard: ({
    feature,
    onToggle,
  }: {
    feature: FeatureFlag;
    isEnabled: boolean;
    onToggle: () => void;
  }) => (
    <div data-testid={`feature-card-${feature.id}`}>
      <span>{feature.name}</span>
      <button onClick={onToggle}>Toggle</button>
    </div>
  ),
}));

vi.mock('../GraduatedSection', () => ({
  GraduatedSection: () => <div data-testid="graduated-section">Graduated Section</div>,
}));

vi.mock('../icons', () => ({
  SparklesIcon: ({ className }: { className?: string }) => (
    <div className={className}>Sparkles</div>
  ),
  CloseIcon: ({ className }: { className?: string }) => <div className={className}>Close</div>,
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('LabsDrawer', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    document.body.style.overflow = '';

    // Default mocks - useLabsStore is called with a selector (useShallow)
    vi.mocked(useLabsStore).mockImplementation((selector) => {
      const state = {
        isDrawerOpen: false,
        closeDrawer: vi.fn(),
        toggleFeature: vi.fn(),
        isFeatureEnabled: vi.fn(() => false),
      };
      return selector ? selector(state) : state;
    });
  });

  it('does not render when closed', () => {
    render(<LabsDrawer />);
    const drawer = screen.getByRole('dialog');
    expect(drawer).toHaveClass('translate-x-full');
  });

  it('renders when open', () => {
    vi.mocked(useLabsStore).mockImplementation((selector) => {
      const state = {
        isDrawerOpen: true,
        closeDrawer: vi.fn(),
        toggleFeature: vi.fn(),
        isFeatureEnabled: vi.fn(() => false),
      };
      return selector ? selector(state) : state;
    });

    render(<LabsDrawer />);
    const drawer = screen.getByRole('dialog');
    expect(drawer).toHaveClass('translate-x-0');
  });

  it('shows labs title in header', () => {
    vi.mocked(useLabsStore).mockImplementation((selector) => {
      const state = {
        isDrawerOpen: true,
        closeDrawer: vi.fn(),
        toggleFeature: vi.fn(),
        isFeatureEnabled: vi.fn(() => false),
      };
      return selector ? selector(state) : state;
    });

    render(<LabsDrawer />);
    expect(screen.getByText('labs.labs')).toBeInTheDocument();
  });

  it('calls closeDrawer when close button clicked', () => {
    const mockCloseDrawer = vi.fn();
    vi.mocked(useLabsStore).mockImplementation((selector) => {
      const state = {
        isDrawerOpen: true,
        closeDrawer: mockCloseDrawer,
        toggleFeature: vi.fn(),
        isFeatureEnabled: vi.fn(() => false),
      };
      return selector ? selector(state) : state;
    });

    render(<LabsDrawer />);
    fireEvent.click(screen.getByLabelText('labs.closeLabs'));

    expect(mockCloseDrawer).toHaveBeenCalled();
  });

  it('renders feature cards', () => {
    vi.mocked(useLabsStore).mockImplementation((selector) => {
      const state = {
        isDrawerOpen: true,
        closeDrawer: vi.fn(),
        toggleFeature: vi.fn(),
        isFeatureEnabled: vi.fn(() => false),
      };
      return selector ? selector(state) : state;
    });

    render(<LabsDrawer />);

    expect(screen.getByTestId('feature-card-feature-1')).toBeInTheDocument();
    expect(screen.getByTestId('feature-card-feature-2')).toBeInTheDocument();
    expect(screen.getByText('Test Feature 1')).toBeInTheDocument();
    expect(screen.getByText('Test Feature 2')).toBeInTheDocument();
  });

  it('renders graduated section', () => {
    vi.mocked(useLabsStore).mockImplementation((selector) => {
      const state = {
        isDrawerOpen: true,
        closeDrawer: vi.fn(),
        toggleFeature: vi.fn(),
        isFeatureEnabled: vi.fn(() => false),
      };
      return selector ? selector(state) : state;
    });

    render(<LabsDrawer />);
    expect(screen.getByTestId('graduated-section')).toBeInTheDocument();
  });

  it('shows empty state when no features available', () => {
    vi.mocked(getToggleableFeatures).mockReturnValue([]);

    vi.mocked(useLabsStore).mockImplementation((selector) => {
      const state = {
        isDrawerOpen: true,
        closeDrawer: vi.fn(),
        toggleFeature: vi.fn(),
        isFeatureEnabled: vi.fn(() => false),
      };
      return selector ? selector(state) : state;
    });

    render(<LabsDrawer />);
    expect(screen.getByText('labs.checkBackLater')).toBeInTheDocument();
  });

  it('locks body scroll when drawer is open', () => {
    vi.mocked(useLabsStore).mockImplementation((selector) => {
      const state = {
        isDrawerOpen: true,
        closeDrawer: vi.fn(),
        toggleFeature: vi.fn(),
        isFeatureEnabled: vi.fn(() => false),
      };
      return selector ? selector(state) : state;
    });

    render(<LabsDrawer />);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('has backdrop with correct opacity when open', () => {
    vi.mocked(useLabsStore).mockImplementation((selector) => {
      const state = {
        isDrawerOpen: true,
        closeDrawer: vi.fn(),
        toggleFeature: vi.fn(),
        isFeatureEnabled: vi.fn(() => false),
      };
      return selector ? selector(state) : state;
    });

    const { container } = render(<LabsDrawer />);
    const backdrop = container.querySelector('.bg-overlay-dark');
    expect(backdrop).toHaveClass('opacity-100');
  });
});
