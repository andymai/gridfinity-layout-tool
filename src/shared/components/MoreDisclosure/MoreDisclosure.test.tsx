import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MoreDisclosure } from './MoreDisclosure';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('MoreDisclosure', () => {
  it('starts closed with default values and opens on click', () => {
    render(
      <MoreDisclosure>
        <input aria-label="Depth" />
      </MoreDisclosure>
    );
    const button = screen.getByRole('button', { name: /common\.more/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('auto-opens when values are non-default, but can still be closed', () => {
    render(
      <MoreDisclosure nonDefault>
        <input aria-label="Depth" />
      </MoreDisclosure>
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('re-opens when values move off the defaults while closed', () => {
    const { rerender } = render(
      <MoreDisclosure nonDefault={false}>
        <input aria-label="Depth" />
      </MoreDisclosure>
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    rerender(
      <MoreDisclosure nonDefault>
        <input aria-label="Depth" />
      </MoreDisclosure>
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows the summary and dot only while closed and non-default', () => {
    render(
      <MoreDisclosure nonDefault summary="2 sides">
        <input aria-label="Depth" />
      </MoreDisclosure>
    );
    // Auto-opened: neither summary nor dot while the values are visible.
    expect(screen.queryByText('2 sides')).not.toBeInTheDocument();
    expect(screen.queryByTestId('more-modified-dot')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('2 sides')).toBeInTheDocument();
    expect(screen.getByTestId('more-modified-dot')).toBeInTheDocument();
  });

  it('keeps children mounted but inert while closed', () => {
    render(
      <MoreDisclosure>
        <input aria-label="Depth" data-help-target="bd-test-depth" />
      </MoreDisclosure>
    );
    const region = document.querySelector('[inert]');
    expect(region).not.toBeNull();
    expect(region?.querySelector('[data-help-target="bd-test-depth"]')).not.toBeNull();
  });

  it('opens itself when a help jump targets a descendant', () => {
    render(
      <MoreDisclosure>
        <input aria-label="Depth" data-help-target="bd-test-depth" />
      </MoreDisclosure>
    );
    fireEvent(window, new CustomEvent('help-jump:any', { detail: { controlId: 'bd-test-depth' } }));
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('ignores a help jump targeting elsewhere', () => {
    render(
      <MoreDisclosure>
        <input aria-label="Depth" data-help-target="bd-test-depth" />
      </MoreDisclosure>
    );
    fireEvent(window, new CustomEvent('help-jump:any', { detail: { controlId: 'bd-other' } }));
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });
});
