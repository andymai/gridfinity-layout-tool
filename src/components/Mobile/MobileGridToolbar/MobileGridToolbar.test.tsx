import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileGridToolbar } from './MobileGridToolbar';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('MobileGridToolbar', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const onFitToScreen = vi.fn();
    render(<MobileGridToolbar onFitToScreen={onFitToScreen} />);
  });

  it('displays zoom percentage', () => {
    const onFitToScreen = vi.fn();
    render(<MobileGridToolbar onFitToScreen={onFitToScreen} />);
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });
});
