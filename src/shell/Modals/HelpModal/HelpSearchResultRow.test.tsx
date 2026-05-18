import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HelpSearchResultRow } from './HelpSearchResultRow';
import type { HelpEntry } from '@/shared/help/helpEntry';
import type * as HelpJumpDispatcherModule from '@/shared/help/helpJumpDispatcher';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, vars?: Record<string, string>) => {
    if (vars) return `${key}::${Object.values(vars).join(',')}`;
    return key;
  },
}));

vi.mock('@/shared/help/helpJumpDispatcher', async () => {
  const actual = await vi.importActual<typeof HelpJumpDispatcherModule>(
    '@/shared/help/helpJumpDispatcher'
  );
  return {
    ...actual,
    jumpToHelpTarget: vi.fn(() => Promise.resolve(true)),
  };
});

describe('HelpSearchResultRow', () => {
  it('renders a Go-to button on feature entries and triggers onJump + jumpToHelpTarget', async () => {
    const onJump = vi.fn();
    const feature: HelpEntry = {
      id: 'feature/grid-editor/print-bed-size',
      kind: 'feature',
      titleKey: 'help.target.printBedSize.title',
      descriptionKey: 'help.target.printBedSize.description',
      target: { surface: 'sidebar:physical-units', controlId: 'print-bed-size' },
    };
    render(<HelpSearchResultRow entry={feature} modifierKey="⌘" onJump={onJump} />);

    const button = screen.getByRole('button', { name: 'help.goTo' });
    fireEvent.click(button);

    const { jumpToHelpTarget } = await import('@/shared/help/helpJumpDispatcher');
    expect(onJump).toHaveBeenCalledTimes(1);
    expect(jumpToHelpTarget).toHaveBeenCalledWith(feature.target);
  });

  it('renders shortcut keycaps without a Go-to button for shortcut entries', () => {
    const shortcut: HelpEntry = {
      id: 'shortcut/general/0',
      kind: 'shortcut',
      titleKey: 'common.undo',
      descriptionKey: 'common.undo',
      keys: 'Z',
      modifier: true,
    };
    render(<HelpSearchResultRow entry={shortcut} modifierKey="⌘" onJump={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'help.goTo' })).toBeNull();
    expect(screen.getByText('Z')).toBeTruthy();
    expect(screen.getByText('⌘')).toBeTruthy();
  });

  it('renders neither key caps nor Go-to button for tip entries', () => {
    const tip: HelpEntry = {
      id: 'tip/halfbin',
      kind: 'tip',
      titleKey: 'help.tip.halfBin',
      descriptionKey: 'help.tip.halfBin.description',
    };
    render(<HelpSearchResultRow entry={tip} modifierKey="⌘" onJump={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'help.goTo' })).toBeNull();
    expect(screen.getByText('help.tip.halfBin')).toBeTruthy();
  });

  it('suppresses the Go-to button on feature entries when showJumpButton=false', () => {
    const feature: HelpEntry = {
      id: 'feature/grid-editor/print-bed-size',
      kind: 'feature',
      titleKey: 'help.target.printBedSize.title',
      descriptionKey: 'help.target.printBedSize.description',
      target: { surface: 'sidebar:physical-units', controlId: 'print-bed-size' },
    };
    render(
      <HelpSearchResultRow
        entry={feature}
        modifierKey="⌘"
        onJump={vi.fn()}
        showJumpButton={false}
      />
    );

    expect(screen.queryByRole('button', { name: 'help.goTo' })).toBeNull();
    expect(screen.getByText('help.target.printBedSize.title')).toBeTruthy();
  });
});
