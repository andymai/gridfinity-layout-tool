import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@vercel/analytics/react', () => ({
  Analytics: () => <div data-testid="vercel-analytics" />,
}));

import { VercelAnalytics } from './VercelAnalytics';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('VercelAnalytics', () => {
  it('renders the Vercel component on a hosted build, including for a "0" value', () => {
    vi.stubEnv('VITE_SELF_HOSTED', '0');
    const { queryByTestId } = render(<VercelAnalytics />);
    expect(queryByTestId('vercel-analytics')).not.toBeNull();
  });

  it('renders nothing on a self-hosted build', () => {
    vi.stubEnv('VITE_SELF_HOSTED', '1');
    const { container } = render(<VercelAnalytics />);
    expect(container.firstChild).toBeNull();
  });
});
