import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileHeader } from './MobileHeader';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      layout: { name: 'Test Layout' },
      setName: vi.fn(),
    }),
}));

vi.mock('@/core/store', () => ({
  useHistoryStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      canUndo: false,
      canRedo: false,
      undo: vi.fn(),
      redo: vi.fn(),
    }),
  useMobileStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      toggleMobilePanel: vi.fn(),
    }),
}));

vi.mock('@/shared/hooks/useCollabMode', () => ({
  useCollabMode: () => ({ isCollaborative: false }),
}));

vi.mock('@/shell/Collab', () => ({
  PresenceAvatars: () => null,
}));

vi.mock('@/shared/components/ToolSwitcher', () => ({
  ToolSwitcher: () => <div data-testid="tool-switcher" />,
}));

describe('MobileHeader', () => {
  it('renders the GitHub link', () => {
    render(<MobileHeader onMenuClick={vi.fn()} saveStatus="idle" />);
    const githubLink = screen.getByText('sidebar.github');
    expect(githubLink.closest('a')).toHaveAttribute(
      'href',
      'https://github.com/andymai/gridfinity-layout-tool'
    );
  });

  it('renders the tip link', () => {
    render(<MobileHeader onMenuClick={vi.fn()} saveStatus="idle" />);
    expect(screen.getByText('sidebar.tip')).toBeInTheDocument();
  });

  it('swaps the layout name for a text field on long press', () => {
    // Rename is the context-menu path here; a plain tap opens the layouts
    // panel instead, which is why this name is not click-to-edit.
    render(<MobileHeader onMenuClick={vi.fn()} saveStatus="idle" />);

    fireEvent.contextMenu(screen.getByText('Test Layout'));

    expect(screen.getByRole('textbox')).toHaveValue('Test Layout');
  });
});
