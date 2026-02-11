import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomNavBar } from './BottomNavBar';
import { resetAllStores } from '@/test/testUtils';
import { useMobileStore } from '@/core/store/mobile';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => {
    const translations: Record<string, string> = {
      'common.layers': 'Layers',
      'mobile.nav.bin': 'Bin',
      'common.categories': 'Categories',
      'mobile.nav.list': 'List',
    };
    return translations[key] || key;
  },
}));

describe('BottomNavBar', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<BottomNavBar />);
  });

  it('displays all navigation items', () => {
    render(<BottomNavBar />);
    expect(screen.getByText('Layers')).toBeInTheDocument();
    expect(screen.getByText('Bin')).toBeInTheDocument();
    expect(screen.getByText('Categories')).toBeInTheDocument();
    expect(screen.getByText('List')).toBeInTheDocument();
  });

  it('toggles mobile panel when nav item clicked', () => {
    render(<BottomNavBar />);
    const layersButton = screen.getByText('Layers').closest('button');
    if (layersButton) {
      fireEvent.click(layersButton);
      expect(useMobileStore.getState().activeMobilePanel).toBe('layers');
    }
  });

  it('marks active panel with aria-pressed', () => {
    useMobileStore.setState({ activeMobilePanel: 'layers' });
    render(<BottomNavBar />);
    const layersButton = screen.getByText('Layers').closest('button');
    expect(layersButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('has data-bottom-nav attribute', () => {
    const { container } = render(<BottomNavBar />);
    expect(container.querySelector('[data-bottom-nav]')).toBeInTheDocument();
  });
});
