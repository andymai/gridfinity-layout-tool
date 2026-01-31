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
});
