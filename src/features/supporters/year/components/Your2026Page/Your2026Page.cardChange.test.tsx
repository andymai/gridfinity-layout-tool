import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { render } from '@testing-library/react';
import type { YearReviewData } from '../../hooks/useYearReviewData';
import type { YearMesh } from '../../hooks/useYearMeshes';
import type { YearStats } from '../../types';
import { Your2026Page } from './Your2026Page';

vi.mock('@/shared/analytics/posthog', () => ({ trackEvent: vi.fn() }));

const stats: YearStats = {
  year: 2026,
  drawers: 2,
  binsPlaced: 12,
  drawerAreaMm2: 300_000,
  biggestDrawer: null,
  favouriteSize: null,
  designs: 0,
  busiestMonth: null,
  monthCounts: Array.from({ length: 12 }, () => 0),
  filament: null,
  longestPrint: null,
  complexityShortlist: [
    { id: 'late', name: 'Caddy', thumbnail: null, params: DEFAULT_BIN_PARAMS, score: 9 },
  ],
  exports: 0,
  type: { id: 'standardIssue', values: {} },
};
const review: { data: YearReviewData } = { data: { status: 'ready', stats } };
vi.mock('../../hooks/useYearReviewData', () => ({ useYearReviewData: () => review.data }));
vi.mock('../../../hooks/useSupportersData', () => ({
  useSupportersData: () => ({ data: { supporters: [] }, settled: true }),
}));

const meshes: { value: ReadonlyMap<string, YearMesh> } = { value: new Map() };
vi.mock('../../hooks/useYearMeshes', () => ({ useYearMeshes: () => meshes.value }));

const seen: unknown[] = [];
vi.mock('../StoryPlayer', () => ({
  StoryPlayer: ({ onCardChange }: { onCardChange?: unknown }) => {
    seen.push(onCardChange);
    return null;
  },
}));

describe('Your2026Page card changes', () => {
  it('keeps one card-change handler when a mesh arrives, so a settled card keeps its image', () => {
    window.history.replaceState(null, '', '/your-2026?preview');
    const { rerender } = render(<Your2026Page />);
    meshes.value = new Map([
      ['late', { mesh: { triangleCount: 1 }, triangles: 1 } as unknown as YearMesh],
    ]);
    rerender(<Your2026Page />);
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
    window.history.replaceState(null, '', '/');
  });
});
