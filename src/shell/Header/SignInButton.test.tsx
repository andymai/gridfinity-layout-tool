import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignInButton } from './SignInButton';
import { useSessionStore } from '@/core/sync/session/useSession';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('SignInButton', () => {
  beforeEach(() => {
    useSessionStore.setState({ status: 'unknown', user: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders nothing while session status is unknown', () => {
    const { container } = render(<SignInButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a sign-in CTA when anonymous', () => {
    useSessionStore.setState({ status: 'anonymous', user: null });
    render(<SignInButton />);
    expect(screen.getByRole('button', { name: 'auth.signIn' })).toBeInTheDocument();
  });

  it('opens a menu with Google + GitHub options when the sign-in CTA is clicked', () => {
    useSessionStore.setState({ status: 'anonymous', user: null });
    render(<SignInButton />);
    fireEvent.click(screen.getByRole('button', { name: 'auth.signIn' }));
    expect(screen.getByText('auth.signInWithGoogle')).toBeInTheDocument();
    expect(screen.getByText('auth.signInWithGithub')).toBeInTheDocument();
  });

  it('renders avatar trigger when authenticated', () => {
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@example.com', displayName: 'Alice' },
    });
    render(<SignInButton />);
    const trigger = screen.getByRole('button', { name: 'auth.userMenuOpen' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('title', 'a@example.com');
  });

  it('shows the user header and Sign out item when the user menu is opened', () => {
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@example.com', displayName: 'Alice' },
    });
    render(<SignInButton />);
    fireEvent.click(screen.getByRole('button', { name: 'auth.userMenuOpen' }));
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText(/a@example\.com/)).toBeInTheDocument();
    expect(screen.getByText('auth.signOut')).toBeInTheDocument();
  });

  it('Sign out flips the store to anonymous on click', async () => {
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', provider: 'google', email: 'a@example.com' },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    render(<SignInButton />);
    fireEvent.click(screen.getByRole('button', { name: 'auth.userMenuOpen' }));
    fireEvent.click(screen.getByText('auth.signOut'));
    // Allow the async signOut handler to settle.
    await new Promise((r) => setTimeout(r, 0));
    expect(useSessionStore.getState().status).toBe('anonymous');
  });
});
