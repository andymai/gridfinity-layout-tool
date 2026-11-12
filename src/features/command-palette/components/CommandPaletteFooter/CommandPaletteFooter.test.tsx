import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CommandPaletteFooter } from './CommandPaletteFooter';
import { COMMAND_DEFINITIONS } from '../../commands';
import type { CommandDefinition } from '../../commands';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
}));

describe('CommandPaletteFooter', () => {
  const mockCommand: CommandDefinition & { isAvailable: boolean } = {
    id: 'test-command',
    labelKey: 'commandPalette.testCommand',
    category: 'edit',
    keywords: [],
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

  function badgeTextAround(key: string): string | null | undefined {
    return screen.getByText(key).parentElement?.closest('div')?.textContent;
  }

  it('shows shortcut badge when command has shortcut', () => {
    render(<CommandPaletteFooter selectedCommand={mockCommand} matchCount={5} />);

    expect(badgeTextAround('K')).toMatch(/^(Ctrl|⌘)\+K$/);
  });

  it('shows Shift for a command whose shortcut needs it', () => {
    const newLayout = COMMAND_DEFINITIONS.find((command) => command.id === 'new-layout');
    if (!newLayout) throw new Error('new-layout command is missing');
    render(
      <CommandPaletteFooter selectedCommand={{ ...newLayout, isAvailable: true }} matchCount={5} />
    );

    expect(badgeTextAround('N')).toBe('Shift+N');
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
