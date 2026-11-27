import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTranslation } from '@/i18n';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { MeshData } from '@/shared/types/generation';
import type { YearStats } from '../../types';
import type { YearCardKind } from '../../utils/yearCards';
import { shareSpecFor, type ShareInput } from './shareSpec';

const stats: YearStats = {
  year: 2026,
  drawers: 3,
  binsPlaced: 40,
  drawerAreaMm2: 300_000,
  biggestDrawer: { layoutId: 'l1', name: 'Workbench', widthMm: 600, depthMm: 450 },
  favouriteSize: { width: 2, depth: 1, count: 12 },
  designs: 4,
  busiestMonth: { month: 2, count: 3 },
  monthCounts: [0, 0, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  filament: { grams: 2430, printMinutes: 8580 },
  longestPrint: {
    id: 'd1',
    name: 'Tool caddy',
    thumbnail: 'data:image/webp;base64,x',
    params: DEFAULT_BIN_PARAMS,
    minutes: 580,
  },
  complexityShortlist: [],
  exports: 9,
  type: { id: 'compartmentalist', values: { count: 12, name: 'Tool caddy' } },
};

function spec(kind: YearCardKind, overrides: Partial<ShareInput> = {}) {
  const t = renderHook(() => useTranslation()).result.current;
  return shareSpecFor(
    { kind, duration: 5 },
    {
      t,
      stats,
      locale: 'en',
      unit: 'mm',
      supporterCount: 312,
      complicated: null,
      drawerPreview: null,
      meshes: new Map(),
      ...overrides,
    }
  );
}

describe('shareSpecFor', () => {
  it('shares the final number, never a count-up', () => {
    expect(spec('drawers')).toMatchObject({
      title: 'You planned 3 drawers.',
      visual: { kind: 'big', text: '3' },
    });
  });

  it('copies the turning bin when its mesh is on screen, else the thumbnail', () => {
    expect(spec('longest')?.visual).toEqual({ kind: 'image', src: 'data:image/webp;base64,x' });
    const mesh = { triangleCount: 10 } as MeshData;
    expect(spec('longest', { meshes: new Map([['d1', { mesh, triangles: 10 }]]) })?.visual).toEqual(
      { kind: 'canvas', thumbnail: 'data:image/webp;base64,x' }
    );
  });

  it('shares the thumbnail for a design the card cannot turn, such as one with a lid', () => {
    const lidMesh = { vertices: new Float32Array(9), triangleCount: 1 };
    const mesh = { triangleCount: 10, lidMesh } as unknown as MeshData;
    expect(spec('longest', { meshes: new Map([['d1', { mesh, triangles: 14 }]]) })?.visual).toEqual(
      { kind: 'image', src: 'data:image/webp;base64,x' }
    );
  });

  it('draws a bin when the design has no mesh or thumbnail yet', () => {
    const bare = {
      ...stats,
      longestPrint: stats.longestPrint && { ...stats.longestPrint, thumbnail: null },
    };
    expect(spec('longest', { stats: bare })?.visual).toEqual({ kind: 'glyph' });
  });

  it('lights at most a full grid of bins', () => {
    expect(spec('bins')?.visual).toEqual({ kind: 'cells', lit: 40, total: 64 });
  });

  it('draws the month bars with the busiest one marked', () => {
    expect(spec('month')?.visual).toMatchObject({ kind: 'bars', highlight: 2 });
  });

  it('lists the summary rows instead of a title', () => {
    const summary = spec('summary');
    expect(summary?.title).toBe('');
    expect(summary?.visual).toMatchObject({ kind: 'rows' });
  });

  it('sets the type name in the pixel font', () => {
    expect(spec('type')?.visual).toEqual({
      kind: 'big',
      text: 'The Compartmentalist',
      pixel: true,
    });
  });
});
