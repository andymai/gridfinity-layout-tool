import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useTranslation } from '@/i18n';
import { gridUnits, heightUnits } from '@/core/types';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { MeshData } from '@/shared/types/generation';
import type * as DetectWebGL from '@/shared/webgl/detectWebGL';
import { roughMeasure } from '../../cards/sceneFixtures.testUtils';
import type { YearStats } from '../../types';
import { yearCard, type YearCardKind } from '../../utils/yearCards';
import { describeCard } from './cardCopy';
import { YearCardView } from './YearCardView';

const spinner = { fail: false };
vi.mock('../SpinningBin', () => ({
  SpinningBin: ({ angle, printTime }: { angle: number; printTime?: number | null }) => {
    if (spinner.fail) throw new Error('Error creating WebGL context.');
    return <div data-testid="spinner" data-angle={angle} data-print={String(printTime)} />;
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
    card: yearCard(kind),
    elapsed: 0,
    stats,
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
    measure: roughMeasure,
    onRollCredits: vi.fn(),
    onSupport: vi.fn(),
    ...overrides,
  };
  render(<YearCardView {...props} />);
  return props;
}

/** Text a screen reader reaches: the whole sentences, not the drawn lines. */
function spoken(text: string): HTMLElement {
  const found = screen.getAllByText(text).filter((el) => !el.closest('[aria-hidden="true"]'));
  if (found.length !== 1) throw new Error(`Expected one spoken "${text}", found ${found.length}`);
  return found[0];
}

beforeEach(() => {
  // jsdom has no 2D canvas; the drawing is checked in the browser pass.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  spinner.fail = false;
  webgl.available = true;
});

describe('YearCardView', () => {
  describe('the turning bin', () => {
    const withThumb: YearStats = {
      ...stats,
      longestPrint: stats.longestPrint && { ...stats.longestPrint, thumbnail: THUMB },
    };
    const showLongest = (mesh: MeshData, overrides: Parameters<typeof show>[1] = {}) =>
      show('longest', {
        stats: withThumb,
        meshes: new Map([['d1', { mesh, triangles: 1 }]]),
        ...overrides,
      });

    it("turns and prints with the card's clock, so a pause stops it", async () => {
      showLongest(bodyMesh(), { elapsed: 3, reducedMotion: false });
      const spinnerEl = await screen.findByTestId('spinner');
      expect(spinnerEl).toHaveAttribute('data-print', '3');
      // It comes to rest at -32° at the card's end, turning 10° a second.
      const end = 8 * (60 / 88);
      expect(Number(spinnerEl.getAttribute('data-angle'))).toBeCloseTo(-32 + 10 * (end - 3));
    });

    it('stands whole and still under reduced motion', async () => {
      showLongest(bodyMesh(), { elapsed: 3, reducedMotion: true });
      const spinnerEl = await screen.findByTestId('spinner');
      expect(spinnerEl).toHaveAttribute('data-print', 'null');
      expect(spinnerEl).toHaveAttribute('data-angle', '-32');
    });

    it('keeps the thumbnail when the 3D canvas fails', async () => {
      spinner.fail = true;
      const silence = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      showLongest(bodyMesh());
      await settle();
      silence.mockRestore();
      expect(screen.queryByTestId('spinner')).toBeNull();
      expect(webgl.available).toBe(false);
    });

    it('keeps the thumbnail where WebGL is missing', async () => {
      webgl.available = false;
      showLongest(bodyMesh());
      await settle();
      expect(screen.queryByTestId('spinner')).toBeNull();
      expect(document.querySelector('[data-year-model] canvas')).not.toBeNull();
    });

    it('keeps the thumbnail for a lid the spinner cannot place', async () => {
      showLongest(bodyMesh({ lidMesh: bodyMesh() }));
      await settle();
      expect(screen.queryByTestId('spinner')).toBeNull();
    });
  });

  it('tells the drawers story for screen readers in whole sentences', () => {
    show('drawers');
    expect(screen.getByRole('heading', { name: 'You planned 3 drawers.' })).toBeInTheDocument();
    expect(spoken('3 fewer places where things go to vanish.')).toBeInTheDocument();
  });

  it('keeps the drawn copy out of the accessibility tree', () => {
    show('drawers');
    const drawn = document.querySelector('[aria-hidden="true"]');
    expect(drawn?.textContent).toContain('You planned');
  });

  it('measures the biggest drawer in the chosen unit', () => {
    show('biggest', { unit: 'in' });
    expect(spoken('24 × 18 in. “Workbench”')).toBeInTheDocument();
  });

  it('splits filament and printer time into two lines', () => {
    show('filament');
    expect(screen.getByRole('heading', { name: '2.4 kg of filament' })).toBeInTheDocument();
    expect(spoken('About 2 spools.')).toBeInTheDocument();
    expect(spoken('143 hours of printer time.')).toBeInTheDocument();
  });

  it('names the busiest month on its own', () => {
    show('month');
    expect(screen.getByRole('heading', { name: 'March' })).toBeInTheDocument();
    expect(spoken('Your busiest month')).toBeInTheDocument();
  });

  it('names the most complicated bin with its triangle count', () => {
    show('complicated', {
      complicated: {
        design: { id: 'd2', name: 'Grid', thumbnail: null, params: DEFAULT_BIN_PARAMS, score: 9 },
        triangles: 1_234_567,
      },
    });
    expect(screen.getByRole('heading', { name: 'Most complicated: “Grid”' })).toBeInTheDocument();
    expect(spoken('1,234,567 triangles. Your slicer remembers this one.')).toBeInTheDocument();
  });

  it('drops the count when no mesh was ready', () => {
    show('complicated', {
      complicated: {
        design: { id: 'd2', name: 'Grid', thumbnail: null, params: DEFAULT_BIN_PARAMS, score: 9 },
        triangles: null,
      },
    });
    expect(spoken('Your slicer remembers this one.')).toBeInTheDocument();
  });

  it('gives the type its name and its reason', () => {
    show('type');
    expect(spoken('The Compartmentalist')).toBeInTheDocument();
    expect(spoken('Because: 12 compartments in “Tool caddy”.')).toBeInTheDocument();
  });

  it('sums the year up', () => {
    show('summary');
    expect(spoken('Printer time')).toBeInTheDocument();
    expect(spoken('143 hr')).toBeInTheDocument();
  });

  it('thanks the supporters and offers the credits and Ko-fi as keys', () => {
    const props = show('thanks');
    expect(
      screen.getByRole('heading', { name: 'Free all year, thanks to 312 people.' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Roll the credits' }));
    fireEvent.click(screen.getByRole('button', { name: 'Support on Ko-fi' }));
    expect(props.onRollCredits).toHaveBeenCalledTimes(1);
    expect(props.onSupport).toHaveBeenCalledTimes(1);
  });

  it('keeps the card for screen readers while its colour fills in', () => {
    show('intro', { hidden: true });
    expect(screen.getByRole('heading', { name: 'Your year, in 42 mm steps.' })).toBeInTheDocument();
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
    expect(describeCard(yearCard('drawers'), input)).toBe(
      'You planned 3 drawers. 3 fewer places where things go to vanish.'
    );
    expect(describeCard(yearCard('summary'), input)).toContain('Drawers: 3');
    expect(describeCard(yearCard('type'), input)).toContain('The Compartmentalist');
  });
});
