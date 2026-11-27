import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TabletPanelOverlay } from './TabletPanelOverlay';
import { resetAllStores } from '@/test/testUtils';

describe('TabletPanelOverlay', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing when closed', () => {
    const onClose = vi.fn();
    render(
      <TabletPanelOverlay isOpen={false} onClose={onClose} side="left">
        <div>Content</div>
      </TabletPanelOverlay>
    );
  });

  it('renders when open', () => {
    const onClose = vi.fn();
    const { getByText } = render(
      <TabletPanelOverlay isOpen={true} onClose={onClose} side="right">
        <div>Panel Content</div>
      </TabletPanelOverlay>
    );
    expect(getByText('Panel Content')).toBeInTheDocument();
  });

  it('stretches the panel to the screen height, so the sidebar keeps its dock on screen', () => {
    const { getByText } = render(
      <TabletPanelOverlay isOpen={true} onClose={vi.fn()} side="left">
        <aside>Sidebar</aside>
      </TabletPanelOverlay>
    );
    const container = getByText('Sidebar').parentElement;
    expect(container).toHaveClass('fixed', 'top-0', 'bottom-0', 'flex');
  });
});
