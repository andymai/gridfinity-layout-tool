import { describe, it, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TabBar } from './TabBar';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

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
