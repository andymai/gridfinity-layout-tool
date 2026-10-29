import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AchievementToast } from './AchievementToast';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('AchievementToast', () => {
  it('announces the achievement through a live region', () => {
    render(<AchievementToast id="poked10" accent="#f59e0b" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('supporters.achievements.unlocked');
    expect(status).toHaveTextContent('supporters.achievements.poked10');
  });

  it('keeps an empty live region between toasts', () => {
    render(<AchievementToast id={null} accent="#f59e0b" />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
