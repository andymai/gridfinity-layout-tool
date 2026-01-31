import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HelpModal } from './HelpModal';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => {
    if (key === 'help.title') return 'Help';
    if (key === 'common.close') return 'Close';
    return key;
  },
}));

describe('HelpModal', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing when open', () => {
    const onClose = vi.fn();
    render(<HelpModal isOpen={true} onClose={onClose} />);
  });

  it('renders nothing when closed', () => {
    const onClose = vi.fn();
    const { container } = render(<HelpModal isOpen={false} onClose={onClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays title when open', () => {
    const onClose = vi.fn();
    render(<HelpModal isOpen={true} onClose={onClose} />);
    expect(screen.getByText('Help')).toBeInTheDocument();
  });
});
