import { describe, it, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ToolsTab } from './ToolsTab';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('ToolsTab', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<ToolsTab />);
  });
});
