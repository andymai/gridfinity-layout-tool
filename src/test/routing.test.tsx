import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../router';

// Mock heavy App component to avoid loading the entire app
vi.mock('../App', () => ({
  default: function MockApp() {
    return <div data-testid="main-app">Main App</div>;
  },
}));

// Mock GuidePage
vi.mock('../guide/GuidePage', () => ({
  GuidePage: function MockGuidePage() {
    return <div data-testid="guide-page">Guide Page</div>;
  },
}));

describe('Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders main app at root path', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/'],
    });

    render(<RouterProvider router={router} />);

    // Wait for lazy-loaded component
    await waitFor(() => {
      expect(screen.getByTestId('main-app')).toBeInTheDocument();
    });
  });

  it('renders guide page at /guide path', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/guide'],
    });

    render(<RouterProvider router={router} />);

    // Wait for lazy-loaded component
    await waitFor(() => {
      expect(screen.getByTestId('guide-page')).toBeInTheDocument();
    });
  });

  it('renders guide page at /guide/:lessonId path', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/guide/basics'],
    });

    render(<RouterProvider router={router} />);

    // Wait for lazy-loaded component
    await waitFor(() => {
      expect(screen.getByTestId('guide-page')).toBeInTheDocument();
    });
  });
});
