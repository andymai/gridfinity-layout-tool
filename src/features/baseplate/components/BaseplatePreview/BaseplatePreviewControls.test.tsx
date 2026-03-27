import { describe, it, expect, vi } from 'vitest';

vi.mock('@/core/constants', () => ({
  FILAMENT_COLORS: [{ color: '#d4d8dc', name: 'Silver' }],
}));

vi.mock('@/shared/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: true, isTouchDevice: false }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('../../store/baseplatePageStore', () => ({}));

const { BaseplatePreviewControls } = await import('./BaseplatePreviewControls');

describe('BaseplatePreviewControls', () => {
  it('exports a component function', () => {
    expect(typeof BaseplatePreviewControls).toBe('function');
  });
});
