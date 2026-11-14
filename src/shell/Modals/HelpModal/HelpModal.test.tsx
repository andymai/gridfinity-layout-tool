import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('opens with the search field focused, ready to type', () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText('help.searchPlaceholder')).toHaveFocus();
  });

  it('links to the docs in a new tab, and keeps the link while searching', () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    const docs = screen.getByRole('link', { name: 'help.readDocs' });
    expect(docs).toHaveAttribute('href', '/docs');
    expect(docs).toHaveAttribute('target', '_blank');

    fireEvent.change(screen.getByPlaceholderText('help.searchPlaceholder'), {
      target: { value: 'rotate' },
    });
    expect(screen.getByRole('link', { name: 'help.readDocs' })).toBeInTheDocument();
  });

  it('switches between shortcuts and tips', () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('help.commandPaletteTip')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'help.tipsInfo' }));
    expect(screen.queryByText('help.commandPaletteTip')).not.toBeInTheDocument();
  });

  it('clears a search on Escape before it closes the dialog', () => {
    const onClose = vi.fn();
    render(<HelpModal isOpen={true} onClose={onClose} />);
    const search = screen.getByPlaceholderText('help.searchPlaceholder');

    fireEvent.change(search, { target: { value: 'rotate' } });
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(search).toHaveValue('');
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(search, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
