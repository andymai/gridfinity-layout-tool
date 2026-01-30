import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolSwitcher } from './ToolSwitcher';

const mockNavigateToDesigner = vi.fn();
const mockNavigateToPlanner = vi.fn();

vi.mock('@/hooks/useFeatureFlag', () => ({
  useFeatureFlag: vi.fn(() => false),
}));

vi.mock('@/hooks/useDesignerRouting', () => ({
  useDesignerRouting: () => ({
    isDesignerRoute: false,
    navigateToDesigner: mockNavigateToDesigner,
    navigateToPlanner: mockNavigateToPlanner,
  }),
}));

import { useFeatureFlag } from '@/hooks/useFeatureFlag';

describe('ToolSwitcher', () => {
  it('shows static title when feature flag disabled', () => {
    vi.mocked(useFeatureFlag).mockReturnValue(false);
    render(<ToolSwitcher />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('shows compact title when feature flag disabled and compact', () => {
    vi.mocked(useFeatureFlag).mockReturnValue(false);
    render(<ToolSwitcher compact />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('shows tablist when feature flag enabled', () => {
    vi.mocked(useFeatureFlag).mockReturnValue(true);
    render(<ToolSwitcher />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('has planner tab selected by default', () => {
    vi.mocked(useFeatureFlag).mockReturnValue(true);
    render(<ToolSwitcher />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });
});
