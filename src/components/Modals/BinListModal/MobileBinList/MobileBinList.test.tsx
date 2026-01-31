import { describe, it, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MobileBinList } from './MobileBinList';
import { resetAllStores } from '@/test/testUtils';

vi.mock('../BinListFilters', () => ({
  BinListFilters: () => <div data-testid="bin-list-filters" />,
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('MobileBinList', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<MobileBinList />);
  });
});
