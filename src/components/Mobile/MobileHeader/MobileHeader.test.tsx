import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileHeader } from './MobileHeader';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

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
  useUIStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      toggleMobilePanel: vi.fn(),
    }),
}));

vi.mock('@/hooks/useCollabMode', () => ({
  useCollabMode: () => ({ isCollaborative: false }),
}));

vi.mock('@/components/Collab', () => ({
  PresenceAvatars: () => null,
}));

vi.mock('@/shared/components/ToolSwitcher', () => ({
  ToolSwitcher: () => <div data-testid="tool-switcher" />,
}));

describe('MobileHeader', () => {
  it('renders the GitHub link', () => {
    render(<MobileHeader onMenuClick={vi.fn()} onHelpClick={vi.fn()} saveStatus="idle" />);
    const githubLink = screen.getByText('mobile.header.github');
    expect(githubLink.closest('a')).toHaveAttribute(
      'href',
      'https://github.com/andymai/gridfinity-layout-tool'
    );
  });

  it('renders the tip link', () => {
    render(<MobileHeader onMenuClick={vi.fn()} onHelpClick={vi.fn()} saveStatus="idle" />);
    expect(screen.getByText('mobile.header.tip')).toBeInTheDocument();
  });
});
