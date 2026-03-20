import { describe, it, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BinContextMenuDesignSection } from './BinContextMenuDesignSection';
import { resetAllStores, createTestBin } from '@/test/testUtils';

vi.mock('@/shared/components/ContextMenu', () => ({
  ContextMenuItem: ({ label }: { label: string }) => <div>{label}</div>,
  ContextMenuDivider: () => <div data-testid="divider" />,
}));

vi.mock('@/features/design-linking', () => ({
  useLinkedDesign: () => ({ linkedDesign: null, hasLink: false }),
  useBinLinking: () => ({
    editLinkedDesign: vi.fn(),
    showCreateDesignDialog: vi.fn(),
    unlinkBin: vi.fn(),
  }),
  useLinkingStore: () => vi.fn(),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('BinContextMenuDesignSection', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const bin = createTestBin();
    const onClose = vi.fn();
    render(<BinContextMenuDesignSection bin={bin} onClose={onClose} />);
  });
});
