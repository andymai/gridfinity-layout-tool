import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CommunityDesignLineage } from '@/shared/types/community';

const openCommunityPublish = vi.fn().mockResolvedValue(undefined);
vi.mock('@/features/bin-designer/hooks/useCommunityPublish', () => ({
  openCommunityPublish: (...a: unknown[]) => openCommunityPublish(...a),
}));

import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useSettingsStore } from '@/core/store';
import { RemixBanner } from './RemixBanner';

const lineage: CommunityDesignLineage = {
  parentId: 'Parent123456',
  rootId: 'Parent123456',
  parentName: 'Screw Bin',
  parentAuthorName: 'Jo',
  rootAuthorName: 'Jo',
};

function setDesigner(partial: { lineage: CommunityDesignLineage | null; id: string | null }) {
  useDesignerStore.setState({ lineage: partial.lineage, currentDesignId: partial.id });
}

function clearDismissed() {
  const settings = useSettingsStore.getState();
  settings.updateSettings({ dismissedHints: [] });
}

describe('RemixBanner', () => {
  beforeEach(() => {
    openCommunityPublish.mockClear();
    clearDismissed();
    setDesigner({ lineage: null, id: null });
  });

  it('renders nothing without lineage', () => {
    setDesigner({ lineage: null, id: 'design-1' });
    render(<RemixBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('names the parent design and author when the loaded design is a remix', () => {
    setDesigner({ lineage, id: 'design-1' });
    render(<RemixBanner />);
    expect(screen.getByRole('status')).toHaveTextContent('Screw Bin');
    expect(screen.getByRole('status')).toHaveTextContent('Jo');
  });

  it('opens the publish dialog from the inline action', () => {
    setDesigner({ lineage, id: 'design-1' });
    render(<RemixBanner />);
    fireEvent.click(screen.getByText('Publish'));
    expect(openCommunityPublish).toHaveBeenCalledWith(null);
  });

  it('dismisses per design and stays visible for a different remix', () => {
    setDesigner({ lineage, id: 'design-1' });
    const { unmount } = render(<RemixBanner />);
    fireEvent.click(screen.getByLabelText('Dismiss remix notice'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    unmount();

    setDesigner({ lineage, id: 'design-2' });
    render(<RemixBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
