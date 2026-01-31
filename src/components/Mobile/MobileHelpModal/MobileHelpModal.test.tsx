import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileHelpModal } from './MobileHelpModal';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => {
    if (key === 'mobile.help') return 'Mobile Help';
    if (key === 'common.close') return 'Close';
    return key;
  },
}));

describe('MobileHelpModal', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing when open', () => {
    const onClose = vi.fn();
    render(<MobileHelpModal isOpen={true} onClose={onClose} />);
  });

  it('renders nothing when closed', () => {
    const onClose = vi.fn();
    const { container } = render(<MobileHelpModal isOpen={false} onClose={onClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays title when open', () => {
    const onClose = vi.fn();
    render(<MobileHelpModal isOpen={true} onClose={onClose} />);
    expect(screen.getByText('Mobile Help')).toBeInTheDocument();
  });
});
