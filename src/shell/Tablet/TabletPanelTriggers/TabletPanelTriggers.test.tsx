import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TabletPanelTriggers } from './TabletPanelTriggers';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('TabletPanelTriggers', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const onOpenLeft = vi.fn();
    const onOpenRight = vi.fn();
    render(
      <TabletPanelTriggers
        leftPanelOpen={false}
        rightPanelOpen={false}
        onOpenLeftPanel={onOpenLeft}
        onOpenRightPanel={onOpenRight}
      />
    );
  });

  it('renders nothing when both panels are open', () => {
    const onOpenLeft = vi.fn();
    const onOpenRight = vi.fn();
    const { container } = render(
      <TabletPanelTriggers
        leftPanelOpen={true}
        rightPanelOpen={true}
        onOpenLeftPanel={onOpenLeft}
        onOpenRightPanel={onOpenRight}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows left panel trigger when left panel is closed', () => {
    const onOpenLeft = vi.fn();
    const onOpenRight = vi.fn();
    render(
      <TabletPanelTriggers
        leftPanelOpen={false}
        rightPanelOpen={true}
        onOpenLeftPanel={onOpenLeft}
        onOpenRightPanel={onOpenRight}
      />
    );
    expect(screen.getByLabelText('tablet.openLayersPanel')).toBeInTheDocument();
  });

  it('shows right panel trigger when right panel is closed', () => {
    const onOpenLeft = vi.fn();
    const onOpenRight = vi.fn();
    render(
      <TabletPanelTriggers
        leftPanelOpen={true}
        rightPanelOpen={false}
        onOpenLeftPanel={onOpenLeft}
        onOpenRightPanel={onOpenRight}
      />
    );
    expect(screen.getByLabelText('tablet.openInspectorPanel')).toBeInTheDocument();
  });
});
