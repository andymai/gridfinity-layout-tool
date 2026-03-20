import { describe, it, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MobilePrintList } from './MobilePrintList';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/features/print-export', () => ({
  PrintList: () => <div data-testid="print-list" />,
}));

describe('MobilePrintList', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<MobilePrintList />);
  });
});
