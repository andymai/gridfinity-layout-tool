// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  INITIAL_COMMUNITY_DETAIL_STATE,
  useCommunityDetailStore,
} from '@/core/store/communityDetail';
import { loadCommunityReopenDesign, loadAuthReturnPath } from '@/shared/utils/communityReturnPath';
import { CommunitySignInPrompt } from './CommunitySignInPrompt';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

// Hash URLs keep jsdom quiet: assigning location.href to a hash change is
// implemented, a full navigation is not.
vi.mock('@/core/sync/session/sessionApi', () => ({
  signInUrl: (provider: string) => `#signin-${provider}`,
}));

describe('CommunitySignInPrompt', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
    useCommunityDetailStore.setState({ ...INITIAL_COMMUNITY_DETAIL_STATE });
  });

  it('renders nothing while closed', () => {
    render(
      <CommunitySignInPrompt
        open={false}
        message="community.signin.likeMessage"
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByText('community.signin.title')).not.toBeInTheDocument();
  });

  it('shows the message and both provider buttons', () => {
    render(<CommunitySignInPrompt open message="community.signin.likeMessage" onClose={vi.fn()} />);
    expect(screen.getByText('community.signin.title')).toBeInTheDocument();
    expect(screen.getByText('community.signin.likeMessage')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'auth.signInWithGoogle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'auth.signInWithGithub' })).toBeInTheDocument();
  });

  it('runs onBeforeSignIn before redirecting to the chosen provider', () => {
    const onBeforeSignIn = vi.fn();
    render(
      <CommunitySignInPrompt
        open
        message="community.signin.likeMessage"
        onClose={vi.fn()}
        onBeforeSignIn={onBeforeSignIn}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'auth.signInWithGithub' }));
    expect(onBeforeSignIn).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#signin-github');
  });

  it('stashes a /community origin on the provider choice so the return hook can restore it', () => {
    window.history.replaceState(null, '', '/community/d/AbCdEf123456');
    render(<CommunitySignInPrompt open message="community.signin.likeMessage" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'auth.signInWithGoogle' }));
    expect(loadAuthReturnPath()).toBe('/community/d/AbCdEf123456');
  });

  it('stashes no return path from a non-community surface (the in-app gallery tab)', () => {
    render(<CommunitySignInPrompt open message="community.signin.likeMessage" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'auth.signInWithGoogle' }));
    expect(loadAuthReturnPath()).toBeNull();
  });

  it('stashes the open detail as a reopen intent on the gallery-tab surface', () => {
    useCommunityDetailStore.getState().open('AbCdEf123456');
    render(
      <CommunitySignInPrompt open message="community.signin.reportMessage" onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'auth.signInWithGoogle' }));
    expect(loadAuthReturnPath()).toBeNull();
    expect(loadCommunityReopenDesign()).toBe('AbCdEf123456');
  });

  it('stashes no reopen intent on the /community route surface (the URL carries the context)', () => {
    window.history.replaceState(null, '', '/community/d/AbCdEf123456');
    useCommunityDetailStore.getState().open('AbCdEf123456');
    render(
      <CommunitySignInPrompt open message="community.signin.reportMessage" onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'auth.signInWithGoogle' }));
    expect(loadAuthReturnPath()).toBe('/community/d/AbCdEf123456');
    expect(loadCommunityReopenDesign()).toBeNull();
  });

  it('stashes no reopen intent when no detail is open', () => {
    render(<CommunitySignInPrompt open message="community.signin.likeMessage" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'auth.signInWithGoogle' }));
    expect(loadCommunityReopenDesign()).toBeNull();
  });
});
