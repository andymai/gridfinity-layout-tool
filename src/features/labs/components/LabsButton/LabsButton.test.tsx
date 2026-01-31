import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LabsButton } from './LabsButton';
import { resetAllStores } from '@/test/testUtils';
import { useLabsStore } from '@/core/store';
import { getFeature } from '@/core/labs';

// Mock stores
vi.mock('@/core/store');

// Mock feature retrieval
vi.mock('@/core/labs', () => ({
  getFeature: vi.fn((id: string) => ({
    id,
    name: `Feature ${id}`,
    status: 'experimental',
  })),
  createDefaultLabsPreferences: vi.fn(() => ({
    enabledFeatures: {},
  })),
}));

vi.mock('../icons', () => ({
  SparklesIcon: ({ className }: { className?: string }) => (
    <div className={className}>Sparkles</div>
  ),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('LabsButton', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Default mock for useLabsStore
    vi.mocked(useLabsStore).mockImplementation((selector) => {
      const state = {
        openDrawer: vi.fn(),
        preferences: { enabledFeatures: {} },
      };
      return selector ? selector(state) : state;
    });

    // Default mock for getFeature
    vi.mocked(getFeature).mockImplementation((id: string) => ({
      id,
      name: `Feature ${id}`,
      status: 'experimental',
    }));
  });

  it('renders labs button with icon and text', () => {
    render(<LabsButton />);

    expect(screen.getByText('labs.labs')).toBeInTheDocument();
    expect(screen.getByText('labs.tryExperimentalFeatures')).toBeInTheDocument();
  });

  it('calls openDrawer when clicked', () => {
    const mockOpenDrawer = vi.fn();
    vi.mocked(useLabsStore).mockImplementation((selector: unknown) => {
      const state = {
        openDrawer: mockOpenDrawer,
        preferences: { enabledFeatures: {} },
      };
      return selector ? (selector as (s: typeof state) => unknown)(state) : state;
    });

    render(<LabsButton />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockOpenDrawer).toHaveBeenCalledTimes(1);
  });

  it('does not show badge when no features enabled', () => {
    render(<LabsButton />);
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it('shows count badge when experimental features are enabled', () => {
    vi.mocked(useLabsStore).mockImplementation((selector: unknown) => {
      const state = {
        openDrawer: vi.fn(),
        preferences: {
          enabledFeatures: {
            'feature-1': true,
            'feature-2': true,
          },
        },
      };
      return selector ? (selector as (s: typeof state) => unknown)(state) : state;
    });

    render(<LabsButton />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('ignores graduated features in count', () => {
    vi.mocked(getFeature).mockImplementation((id: string) => ({
      id,
      name: `Feature ${id}`,
      status: id === 'graduated-feature' ? 'graduated' : 'experimental',
    }));

    vi.mocked(useLabsStore).mockImplementation((selector: unknown) => {
      const state = {
        openDrawer: vi.fn(),
        preferences: {
          enabledFeatures: {
            'experimental-feature': true,
            'graduated-feature': true,
          },
        },
      };
      return selector ? (selector as (s: typeof state) => unknown)(state) : state;
    });

    render(<LabsButton />);
    // Should only count experimental feature
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows overflow indicator when more than 9 features enabled', () => {
    const enabledFeatures: Record<string, boolean> = {};
    for (let i = 0; i < 12; i++) {
      enabledFeatures[`feature-${i}`] = true;
    }

    vi.mocked(useLabsStore).mockImplementation((selector: unknown) => {
      const state = {
        openDrawer: vi.fn(),
        preferences: { enabledFeatures },
      };
      return selector ? (selector as (s: typeof state) => unknown)(state) : state;
    });

    render(<LabsButton />);
    expect(screen.getByText('common.overflowCount')).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    render(<LabsButton />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label');
  });
});
