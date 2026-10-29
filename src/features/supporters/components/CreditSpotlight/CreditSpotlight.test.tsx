import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreditSpotlight } from './CreditSpotlight';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('CreditSpotlight', () => {
  it('announces who the link stars', () => {
    render(<CreditSpotlight name="Ada" accent="#f59e0b" stageInset="0px" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('supporters.credits.nowStarring');
    expect(status).toHaveTextContent('Ada');
  });
});
