import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThanksCard } from './ThanksCard';
import { getSupportersPalette } from '../../scene/palette';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const palette = getSupportersPalette('dark', 'amber');

describe('ThanksCard', () => {
  it('thanks a named supporter with their message and department', () => {
    render(
      <ThanksCard
        bin={{ id: 'a', name: 'Ada', message: 'lovely', isNewest: false }}
        department="Magnet Hole Inspection"
        palette={palette}
        stageInset="0px"
      />
    );
    expect(screen.getByText('supporters.thanksNamed')).toBeInTheDocument();
    expect(screen.getByText('lovely')).toBeInTheDocument();
    expect(screen.getByText('Magnet Hole Inspection')).toBeInTheDocument();
  });

  it('thanks an anonymous supporter without a message', () => {
    render(
      <ThanksCard
        bin={{ id: 'x', name: null, isNewest: false }}
        department="Department of [REDACTED]"
        palette={palette}
        stageInset="0px"
      />
    );
    expect(screen.getByText('supporters.thanksAnon')).toBeInTheDocument();
  });
});
