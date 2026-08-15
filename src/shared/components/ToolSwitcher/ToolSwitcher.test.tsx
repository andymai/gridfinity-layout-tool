import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolSwitcher } from './ToolSwitcher';
import { resetIntentPrefetchForTests } from '@/shared/hooks/useIntentPrefetch';

const mockNavigateToDesigner = vi.fn();
const mockNavigateToPlanner = vi.fn();
let mockIsDesignerRoute = false;

vi.mock('@/shared/hooks/useDesignerRouting', () => ({
  useDesignerRouting: () => ({
    isDesignerRoute: mockIsDesignerRoute,
    navigateToDesigner: mockNavigateToDesigner,
    navigateToPlanner: mockNavigateToPlanner,
  }),
}));

const mockNavigateToBaseplate = vi.fn();
let mockIsBaseplateRoute = false;

vi.mock('@/shared/hooks/useBaseplateRouting', () => ({
  useBaseplateRouting: () => ({
    isBaseplateRoute: mockIsBaseplateRoute,
    navigateToBaseplate: mockNavigateToBaseplate,
  }),
}));

let mockIsCommunityRoute = false;

vi.mock('@/shared/hooks/useCommunityRouting', () => ({
  useCommunityRouting: () => ({ isCommunityRoute: mockIsCommunityRoute }),
}));

const mockWarmDesigner = vi.fn();
const mockWarmBaseplate = vi.fn();

vi.mock('@/shared/hooks/usePrefetchChunks', () => ({
  warmDesigner: () => mockWarmDesigner(),
  warmBaseplate: () => mockWarmBaseplate(),
}));

describe('ToolSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDesignerRoute = false;
    mockIsBaseplateRoute = false;
    mockIsCommunityRoute = false;
    resetIntentPrefetchForTests();
  });

  it('shows tablist', () => {
    render(<ToolSwitcher />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('has planner tab selected by default', () => {
    render(<ToolSwitcher />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
  });

  it('has designer tab selected when on designer route', () => {
    mockIsDesignerRoute = true;
    render(<ToolSwitcher />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
  });

  it('has baseplate tab selected when on baseplate route', () => {
    mockIsBaseplateRoute = true;
    render(<ToolSwitcher />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
  });

  it('navigates to designer when clicking designer tab', async () => {
    const user = userEvent.setup();
    render(<ToolSwitcher />);

    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[1]);

    expect(mockNavigateToDesigner).toHaveBeenCalledTimes(1);
  });

  it('navigates to baseplate when clicking baseplate tab', async () => {
    const user = userEvent.setup();
    render(<ToolSwitcher />);

    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[2]);

    expect(mockNavigateToBaseplate).toHaveBeenCalledTimes(1);
  });

  it('navigates to planner when clicking planner tab', async () => {
    const user = userEvent.setup();
    mockIsDesignerRoute = true;
    render(<ToolSwitcher />);

    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[0]);

    expect(mockNavigateToPlanner).toHaveBeenCalledTimes(1);
  });

  it('does not navigate when clicking already active tab', async () => {
    const user = userEvent.setup();
    render(<ToolSwitcher />);

    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[0]);

    expect(mockNavigateToPlanner).not.toHaveBeenCalled();
    expect(mockNavigateToDesigner).not.toHaveBeenCalled();
    expect(mockNavigateToBaseplate).not.toHaveBeenCalled();
  });

  it('renders icons in tabs', () => {
    render(<ToolSwitcher />);
    const svgs = document.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(3);
  });

  it('shows text labels by default', () => {
    render(<ToolSwitcher />);
    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByText('Bins')).toBeInTheDocument();
    expect(screen.getByText('Baseplate')).toBeInTheDocument();
  });

  it('hides text labels in iconOnly mode', () => {
    render(<ToolSwitcher iconOnly />);
    expect(screen.queryByText('Layout')).not.toBeInTheDocument();
    expect(screen.queryByText('Bins')).not.toBeInTheDocument();
    expect(screen.queryByText('Baseplate')).not.toBeInTheDocument();
  });

  it('has accessible labels', () => {
    render(<ToolSwitcher />);
    expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Tool Switcher');
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Active tool');
  });

  it('navigates when clicking inactive tab in iconOnly mode', async () => {
    const user = userEvent.setup();
    render(<ToolSwitcher iconOnly />);

    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[1]);

    expect(mockNavigateToDesigner).toHaveBeenCalledTimes(1);
  });

  it('does not navigate when clicking active tab in iconOnly mode', async () => {
    const user = userEvent.setup();
    render(<ToolSwitcher iconOnly />);

    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[0]);

    expect(mockNavigateToPlanner).not.toHaveBeenCalled();
    expect(mockNavigateToDesigner).not.toHaveBeenCalled();
    expect(mockNavigateToBaseplate).not.toHaveBeenCalled();
  });

  it('shows title only on inactive tabs', () => {
    render(<ToolSwitcher />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).not.toHaveAttribute('title'); // active tab
    expect(tabs[1].getAttribute('title')).toContain('Switch to Bin Designer');
    expect(tabs[2].getAttribute('title')).toContain('Switch to Baseplate Generator');
  });

  describe('on the community route', () => {
    it('holds only the three editors', () => {
      mockIsCommunityRoute = true;
      render(<ToolSwitcher />);
      expect(screen.getAllByRole('tab')).toHaveLength(3);
    });

    it('marks nothing active, since no editor is open', () => {
      mockIsCommunityRoute = true;
      render(<ToolSwitcher />);
      for (const tab of screen.getAllByRole('tab')) {
        expect(tab).toHaveAttribute('aria-selected', 'false');
      }
    });

    it('keeps every segment live, so the switcher is the way out', async () => {
      mockIsCommunityRoute = true;
      const user = userEvent.setup();
      render(<ToolSwitcher />);

      await user.click(screen.getAllByRole('tab')[0]);

      expect(mockNavigateToPlanner).toHaveBeenCalledTimes(1);
    });
  });

  // Both editors are lazy chunks plus a geometry kernel, so the fetch has to
  // start on the reach rather than on the click — otherwise the panel is blank
  // for as long as the chunk takes, every time.
  describe('prefetch on intent', () => {
    it('warms the designer when the pointer reaches its segment', async () => {
      const user = userEvent.setup();
      render(<ToolSwitcher />);

      await user.hover(screen.getAllByRole('tab')[1]);

      expect(mockWarmDesigner).toHaveBeenCalledTimes(1);
      expect(mockWarmBaseplate).not.toHaveBeenCalled();
      expect(mockNavigateToDesigner).not.toHaveBeenCalled();
    });

    it('warms the baseplate when its segment takes focus', () => {
      render(<ToolSwitcher />);

      screen.getAllByRole('tab')[2].focus();

      expect(mockWarmBaseplate).toHaveBeenCalledTimes(1);
      expect(mockWarmDesigner).not.toHaveBeenCalled();
    });

    // Touch never hovers, and the idle tier-prefetch stands down on those
    // devices, so pointerdown is the only warning they give.
    it('warms on pointer-down, which is all a touch device offers', async () => {
      const user = userEvent.setup();
      render(<ToolSwitcher />);

      await user.pointer({ keys: '[TouchA>]', target: screen.getAllByRole('tab')[1] });

      expect(mockWarmDesigner).toHaveBeenCalledTimes(1);
    });

    it('leaves the planner alone — it is the eager route', async () => {
      const user = userEvent.setup();
      render(<ToolSwitcher />);

      await user.hover(screen.getAllByRole('tab')[0]);

      expect(mockWarmDesigner).not.toHaveBeenCalled();
      expect(mockWarmBaseplate).not.toHaveBeenCalled();
    });
  });
});
