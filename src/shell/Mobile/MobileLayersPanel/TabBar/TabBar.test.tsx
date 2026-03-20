import { describe, it, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TabBar } from './TabBar';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('TabBar', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const onChange = vi.fn();
    const tabs = [
      { id: 'layers', label: 'Layers' },
      { id: 'categories', label: 'Categories' },
    ];
    render(<TabBar tabs={tabs} activeTab="layers" onChange={onChange} />);
  });
});
