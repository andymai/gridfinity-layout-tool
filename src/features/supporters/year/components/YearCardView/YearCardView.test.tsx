import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useTranslation } from '@/i18n';
import { gridUnits, heightUnits } from '@/core/types';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { MeshData } from '@/shared/types/generation';
import type * as DetectWebGL from '@/shared/webgl/detectWebGL';
import type { YearStats } from '../../types';
import type { YearCardKind } from '../../utils/yearCards';
import { describeCard } from './cardCopy';
import { YearCardView } from './YearCardView';

const spinner = { fail: false };
vi.mock('../SpinningBin', () => ({
  SpinningBin: ({ turnSeconds }: { turnSeconds: number }) => {
    if (spinner.fail) throw new Error('Error creating WebGL context.');
    return <div data-testid="spinner" data-turn={turnSeconds} />;
  },
}));

const webgl = { available: true };
vi.mock('@/shared/webgl/detectWebGL', async (importOriginal) => ({
  ...(await importOriginal<typeof DetectWebGL>()),
  detectWebGL: () =>
    webgl.available ? { available: true } : { available: false, reason: 'no-context' },
  markWebGLUnavailable: () => {
    webgl.available = false;
  },
}));

const THUMB = 'data:image/png;base64,thumb';

function bodyMesh(extra: Partial<MeshData> = {}): MeshData {
  return {
    vertices: new Float32Array(9),
    normals: new Float32Array(0),
    indices: new Uint32Array(0),
    edgeVertices: new Float32Array(0),
    triangleCount: 1,
    ...extra,
  };
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

const stats: YearStats = {
  year: 2026,
  drawers: 3,
  binsPlaced: 40,
  drawerAreaMm2: 612 * 455,
  biggestDrawer: { layoutId: 'l1', name: 'Workbench', widthMm: 609.6, depthMm: 457.2 },
  favouriteSize: { width: 2, depth: 1, count: 12 },
  designs: 4,
  busiestMonth: { month: 2, count: 3 },
  monthCounts: [0, 0, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  filament: { grams: 2430, printMinutes: 8580 },
  longestPrint: {
    id: 'd1',
    name: 'Tool caddy',
    thumbnail: null,
    params: DEFAULT_BIN_PARAMS,
    minutes: 580,
  },
  complexityShortlist: [],
  exports: 9,
  type: { id: 'compartmentalist', values: { count: 12, name: 'Tool caddy' } },
};

function show(kind: YearCardKind, overrides: Partial<Parameters<typeof YearCardView>[0]> = {}) {
  const props = {
    card: { kind, duration: 5 },
    elapsed: 0,
    stats,
    accent: '#3b82f6',
    locale: 'en',
    unit: 'mm' as const,
    reducedMotion: true,
    supporterCount: 312,
    drawerPreview: {
      drawerWidth: gridUnits(10),
      drawerDepth: gridUnits(8),
      drawerHeight: heightUnits(12),
      binCount: 1,
      layerCount: 1,
      binMap: [{ x: gridUnits(0), y: gridUnits(0), w: gridUnits(2), d: gridUnits(1), c: '#fff' }],
    },
    meshes: new Map(),
    complicated: null,
    onRollCredits: vi.fn(),
    onSupport: vi.fn(),
    ...overrides,
  };
  render(<YearCardView {...props} />);
  return props;
}

describe('YearCardView', () => {
  afterEach(() => {
    spinner.fail = false;
    webgl.available = true;
  });

  describe('the turning bin', () => {
    const withThumb = { ...stats, longestPrint: { ...stats.longestPrint, thumbnail: THUMB } };
    const showLongest = (mesh: MeshData, overrides: Parameters<typeof show>[1] = {}) =>
      show('longest', {
        stats: withThumb as YearStats,
        meshes: new Map([['d1', { mesh, triangles: 1 }]]),
        ...overrides,
      });

    it("turns with the card's clock, so a pause stops it", async () => {
      showLongest(bodyMesh(), { elapsed: 3, reducedMotion: false });
      expect(await screen.findByTestId('spinner')).toHaveAttribute('data-turn', '3');
    });

    it('stands still under reduced motion', async () => {
      showLongest(bodyMesh(), { elapsed: 3, reducedMotion: true });
      expect(await screen.findByTestId('spinner')).toHaveAttribute('data-turn', '0');
    });

    it('keeps the thumbnail when the 3D canvas fails', async () => {
      spinner.fail = true;
      const silence = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      showLongest(bodyMesh());
      await settle();
      silence.mockRestore();
      expect(document.querySelector(`img[src="${THUMB}"]`)).not.toBeNull();
      expect(webgl.available).toBe(false);
    });

    it('keeps the thumbnail where WebGL is missing', async () => {
      webgl.available = false;
      showLongest(bodyMesh());
      await settle();
      expect(screen.queryByTestId('spinner')).toBeNull();
      expect(document.querySelector(`img[src="${THUMB}"]`)).not.toBeNull();
    });

    it('keeps the thumbnail for a lid the spinner cannot place', async () => {
      showLongest(bodyMesh({ lidMesh: bodyMesh() }));
      await settle();
      expect(screen.queryByTestId('spinner')).toBeNull();
    });
  });

  it('tells the drawers story with the final count under reduced motion', () => {
    show('drawers');
    expect(screen.getByRole('heading', { name: 'You planned 3 drawers.' })).toBeInTheDocument();
    expect(screen.getByText('3 fewer places where things go to vanish.')).toBeInTheDocument();
  });

  it('counts up from zero at the start of a card', () => {
    show('bins', { reducedMotion: false, elapsed: 0 });
    expect(screen.getByRole('heading', { name: '0 bins placed.' })).toBeInTheDocument();
  });

  it('measures the biggest drawer in the chosen unit', () => {
    show('biggest', { unit: 'in' });
    expect(screen.getByText('24 × 18 in. “Workbench”')).toBeInTheDocument();
  });

  it('splits filament and printer time into two lines', () => {
    show('filament');
    expect(screen.getByRole('heading', { name: '2.4 kg of filament' })).toBeInTheDocument();
    expect(screen.getByText('About 2 spools.')).toBeInTheDocument();
    expect(screen.getByText('143 hours of printer time.')).toBeInTheDocument();
  });

  it('names the busiest month on its own', () => {
    show('month');
    expect(screen.getByRole('heading', { name: 'March' })).toBeInTheDocument();
  });

  it('names the most complicated bin with its triangle count', () => {
    show('complicated', {
      complicated: {
        design: { id: 'd2', name: 'Grid', thumbnail: null, params: DEFAULT_BIN_PARAMS, score: 9 },
        triangles: 1_234_567,
      },
    });
    expect(screen.getByRole('heading', { name: 'Most complicated: “Grid”' })).toBeInTheDocument();
    expect(
      screen.getByText('1,234,567 triangles. Your slicer remembers this one.')
    ).toBeInTheDocument();
  });

  it('drops the count when no mesh was ready', () => {
    show('complicated', {
      complicated: {
        design: { id: 'd2', name: 'Grid', thumbnail: null, params: DEFAULT_BIN_PARAMS, score: 9 },
        triangles: null,
      },
    });
    expect(screen.getByText('Your slicer remembers this one.')).toBeInTheDocument();
  });

  it('gives the type its reason', () => {
    show('type');
    expect(screen.getByText('The Compartmentalist')).toBeInTheDocument();
    expect(screen.getByText('Because: 12 compartments in “Tool caddy”.')).toBeInTheDocument();
  });

  it('sums the year up', () => {
    show('summary');
    expect(screen.getByText('Printer time')).toBeInTheDocument();
    expect(screen.getByText('143 hr')).toBeInTheDocument();
  });

  it('thanks the supporters and offers the credits and Ko-fi', () => {
    const props = show('thanks');
    expect(
      screen.getByRole('heading', { name: 'Free all year, thanks to 312 people.' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Roll the credits' }));
    fireEvent.click(screen.getByRole('button', { name: 'Support on Ko-fi' }));
    expect(props.onRollCredits).toHaveBeenCalledTimes(1);
    expect(props.onSupport).toHaveBeenCalledTimes(1);
  });

  it('lightens a dark accent for small text', () => {
    show('month', { accent: '#7c3aed' });
    const kicker = screen.getByText('Your busiest month');
    expect(kicker.style.color).not.toBe('rgb(124, 58, 237)');
  });

  it('describes a card with its final numbers for screen readers', () => {
    const t = renderHook(() => useTranslation()).result.current;
    const input = {
      t,
      stats,
      locale: 'en',
      unit: 'mm' as const,
      supporterCount: 312,
      complicated: null,
    };
    expect(describeCard({ kind: 'drawers', duration: 5 }, input)).toBe(
      'You planned 3 drawers. 3 fewer places where things go to vanish.'
    );
    expect(describeCard({ kind: 'summary', duration: 5 }, input)).toContain('Drawers: 3');
    expect(describeCard({ kind: 'type', duration: 5 }, input)).toContain('The Compartmentalist');
  });
});
