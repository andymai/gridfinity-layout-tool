import { describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CreditsFinale } from './CreditsFinale';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const setup = (over: Partial<React.ComponentProps<typeof CreditsFinale>> = {}) => {
  const props = {
    total: 248,
    count: 120,
    thisMonth: 0,
    accent: '#f59e0b',
    theme: 'dark' as const,
    stageInset: '0px',
    panelLabel: 'supporters.panel.title',
    endTagRef: createRef<HTMLDivElement>(),
    onKofi: vi.fn(),
    onReplay: vi.fn(),
    onOpenPanel: vi.fn(),
    soundOn: false,
    onToggleSound: vi.fn(),
    ...over,
  };
  render(<CreditsFinale {...props} />);
  return props;
};

describe('CreditsFinale', () => {
  it('announces the real total while the visible count is still climbing', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^248 /);
  });

  it('mentions this month only when someone joined', () => {
    setup({ thisMonth: 3 });
    expect(screen.getByText('supporters.thisMonth')).toBeInTheDocument();
  });

  it('hands the scene the end tag to pin over the empty socket', () => {
    const props = setup();
    expect(props.endTagRef.current).toHaveTextContent('supporters.credits.theEnd');
  });

  it('wires the ask, the replay and the panel', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'supporters.cta.button' }));
    fireEvent.click(screen.getByRole('button', { name: 'supporters.credits.replay' }));
    fireEvent.click(screen.getByRole('button', { name: 'supporters.panel.title' }));
    expect(props.onKofi).toHaveBeenCalledTimes(1);
    expect(props.onReplay).toHaveBeenCalledTimes(1);
    expect(props.onOpenPanel).toHaveBeenCalledTimes(1);
  });

  it('leaves out replay when there is nothing to replay', () => {
    setup({ onReplay: undefined });
    expect(screen.queryByRole('button', { name: 'supporters.credits.replay' })).toBeNull();
  });
});
