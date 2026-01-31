import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CommandPaletteFooter } from './CommandPaletteFooter';
import type { CommandDefinition } from '../../commands';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
}));

vi.mock('../ShortcutBadge', () => ({
  ShortcutBadge: ({ keys, modifier }: { keys: string | string[]; modifier?: boolean }) => (
    <div data-testid="shortcut-badge">
      {modifier && 'Mod+'}
      {Array.isArray(keys) ? keys.join('/') : keys}
    </div>
  ),
}));

describe('CommandPaletteFooter', () => {
  const mockCommand: CommandDefinition & { isAvailable: boolean } = {
    id: 'test-command',
    name: 'Test Command',
    description: 'Test description',
    keywords: [],
    handler: vi.fn(),
    isAvailable: true,
    shortcut: {
      keys: 'K',
      modifier: true,
    },
  };

  it('renders action hints', () => {
    render(<CommandPaletteFooter selectedCommand={null} matchCount={5} />);

    expect(screen.getByText('commandPalette.footer.run')).toBeInTheDocument();
    expect(screen.getByText('commandPalette.footer.navigate')).toBeInTheDocument();
  });

  it('shows close hint on desktop', () => {
    render(<CommandPaletteFooter selectedCommand={null} matchCount={5} />);

    expect(screen.getByText('common.close')).toBeInTheDocument();
  });

  it('displays command count when no command selected', () => {
    render(<CommandPaletteFooter selectedCommand={null} matchCount={10} />);

    expect(screen.getByText(/commandPalette.footer.commandCount/)).toBeInTheDocument();
  });

  it('shows shortcut badge when command has shortcut', () => {
    render(<CommandPaletteFooter selectedCommand={mockCommand} matchCount={5} />);

    expect(screen.getByTestId('shortcut-badge')).toBeInTheDocument();
    expect(screen.getByTestId('shortcut-badge')).toHaveTextContent('Mod+K');
  });

  it('shows command count when selected command has no shortcut', () => {
    const commandWithoutShortcut = {
      ...mockCommand,
      shortcut: undefined,
    };

    render(<CommandPaletteFooter selectedCommand={commandWithoutShortcut} matchCount={3} />);

    expect(screen.getByText(/commandPalette.footer.commandCount/)).toBeInTheDocument();
  });

  it('renders keyboard hint badges', () => {
    const { container } = render(<CommandPaletteFooter selectedCommand={null} matchCount={5} />);

    const kbdElements = container.querySelectorAll('kbd');
    expect(kbdElements.length).toBeGreaterThan(0);
  });
});
