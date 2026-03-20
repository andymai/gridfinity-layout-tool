import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileCategoriesPanel } from './MobileCategoriesPanel';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/shared/components/ConfirmDialog', () => ({
  ConfirmDialog: () => <div data-testid="confirm-dialog" />,
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('MobileCategoriesPanel', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<MobileCategoriesPanel />);
  });

  it('displays add category button', () => {
    render(<MobileCategoriesPanel />);
    expect(screen.getByText('categories.addCategory')).toBeInTheDocument();
  });
});
