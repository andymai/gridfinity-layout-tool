import { describe, it, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MobileLayersPanel } from './MobileLayersPanel';
import { resetAllStores } from '@/test/testUtils';

vi.mock('./TabBar', () => ({
  TabBar: () => <div data-testid="tab-bar" />,
}));

vi.mock('./LayersTab', () => ({
  LayersTab: () => <div data-testid="layers-tab" />,
}));

vi.mock('./ToolsTab', () => ({
  ToolsTab: () => <div data-testid="tools-tab" />,
}));

describe('MobileLayersPanel', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<MobileLayersPanel />);
  });
});
