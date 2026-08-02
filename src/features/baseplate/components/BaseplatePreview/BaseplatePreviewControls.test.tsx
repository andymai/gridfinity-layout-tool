import { describe, it, expect, vi } from 'vitest';

vi.mock('@/core/constants', () => ({
  FILAMENT_COLORS: [{ color: '#d4d8dc', nameKey: 'colors.filament.lightGrey' }],
}));

vi.mock('@/shared/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: true, isTouchDevice: false }),
}));

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

vi.mock('../../store/baseplatePageStore', () => ({}));

const { BaseplatePreviewControls } = await import('./BaseplatePreviewControls');

describe('BaseplatePreviewControls', () => {
  it('exports a component function', () => {
    expect(typeof BaseplatePreviewControls).toBe('function');
  });
});
