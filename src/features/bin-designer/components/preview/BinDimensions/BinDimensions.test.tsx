import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BinDimensions } from './BinDimensions';
import type { AssembledSegment } from '@/shared/printSettings/assembledHeight';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useThree: () => ({
    camera: {
      position: { set: vi.fn(), x: 0, y: 5, z: 5 },
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn(),
    },
    invalidate: vi.fn(),
    gl: { domElement: document.createElement('canvas') },
    size: { width: 800, height: 600 },
    scene: {},
  }),
  useFrame: vi.fn(),
  extend: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
  Line: () => <div data-testid="line" />,
  Text: ({ children }: { children: ReactNode }) => <div data-testid="r3f-text">{children}</div>,
}));

/** 6u bin with a lip, seated on a magnet plate — one band of every kind. */
const SEGMENTS: AssembledSegment[] = [
  { kind: 'baseplate', mm: 2.5, startMm: 0 },
  { kind: 'bin', mm: 42, startMm: 2.5 },
  { kind: 'stackingLip', mm: 4.3, startMm: 44.5 },
];
const TOTAL = 48.8;

const segmentLabel = (s: AssembledSegment): string => `${s.kind} ${s.mm}mm`;

function renderDims(props: Partial<React.ComponentProps<typeof BinDimensions>> = {}) {
  return render(
    <BinDimensions
      width={2}
      depth={3}
      gridUnitMm={42}
      segments={SEGMENTS}
      totalMm={TOTAL}
      expanded={false}
      segmentLabel={segmentLabel}
      {...props}
    />
  );
}

function texts(): string[] {
  return screen.getAllByTestId('r3f-text').map((n) => n.textContent ?? '');
}

describe('BinDimensions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders width, depth and height annotations', () => {
    renderDims();
    expect(screen.getAllByTestId('line').length).toBeGreaterThan(0);
    expect(texts()).toEqual(expect.arrayContaining(['84mm', '126mm', '48.8mm']));
  });

  it('labels the height with the assembled total, not the bin body', () => {
    renderDims();
    expect(texts()).toContain('48.8mm');
    expect(texts()).not.toContain('42mm');
  });

  it('renders with fractional dimensions', () => {
    renderDims({ width: 2.5, depth: 3.5 });
    expect(texts()).toEqual(expect.arrayContaining(['105mm', '147mm']));
  });

  it('uses the depth-axis pitch on a non-square grid', () => {
    renderDims({ gridUnitMmY: 21 });
    expect(texts()).toContain('63mm');
  });

  describe('collapsed', () => {
    it('shows no band labels', () => {
      renderDims();
      expect(texts().some((s) => s.startsWith('bin '))).toBe(false);
    });
  });

  describe('expanded', () => {
    it('labels each band tall enough to hold one', () => {
      renderDims({ expanded: true });
      expect(texts()).toEqual(expect.arrayContaining(['bin 42mm', 'stackingLip 4.3mm']));
    });

    it('drops the label on a band shorter than its own text', () => {
      // The 2.5mm magnet floor cannot hold a label without colliding with the
      // bin band above it; the sidebar row still reports it.
      renderDims({ expanded: true });
      expect(texts()).not.toContain('baseplate 2.5mm');
    });

    it('labels a plate band once it is tall enough', () => {
      renderDims({
        expanded: true,
        segments: [
          { kind: 'baseplate', mm: 6, startMm: 0 },
          { kind: 'bin', mm: 42, startMm: 6 },
        ],
        totalMm: 48,
      });
      expect(texts()).toContain('baseplate 6mm');
    });

    it('still shows the total', () => {
      renderDims({ expanded: true });
      expect(texts()).toContain('48.8mm');
    });

    it('omits the label for a band too thin to fit one', () => {
      // A plain plate the bin fully nests into contributes 0mm.
      renderDims({
        expanded: true,
        segments: [
          { kind: 'baseplate', mm: 0, startMm: 0 },
          { kind: 'bin', mm: 42, startMm: 0 },
        ],
        totalMm: 42,
      });
      expect(texts()).toContain('bin 42mm');
      expect(texts()).not.toContain('baseplate 0mm');
    });

    it('draws a boundary mark per band on top of the end caps', () => {
      const collapsed = renderDims().container.querySelectorAll('[data-testid="line"]').length;
      const expanded = renderDims({ expanded: true }).container.querySelectorAll(
        '[data-testid="line"]'
      ).length;
      // The first band's boundary coincides with the bottom end cap, so only the
      // interior boundaries add lines.
      expect(expanded).toBe(collapsed + SEGMENTS.length - 1);
    });

    it('draws one mark per Z when a zero-height band shares a boundary', () => {
      // The default case: a plain plate the bin fully nests into. Plate start,
      // bin start and the bottom end cap all land on Z=0, and these lines are
      // semi-transparent, so stacking them would darken that rule.
      const nested = [
        { kind: 'baseplate', mm: 0, startMm: 0 },
        { kind: 'bin', mm: 42, startMm: 0 },
        { kind: 'stackingLip', mm: 4.3, startMm: 42 },
      ] as const;
      const collapsed = renderDims({
        segments: [...nested],
        totalMm: 46.3,
      }).container.querySelectorAll('[data-testid="line"]').length;
      const expanded = renderDims({
        segments: [...nested],
        totalMm: 46.3,
        expanded: true,
      }).container.querySelectorAll('[data-testid="line"]').length;
      // Only the stacking-lip boundary at Z=42 is new.
      expect(expanded).toBe(collapsed + 1);
    });
  });

  it('renders the stack pitch label when given one', () => {
    renderDims({ stackPitchLabel: 'stacks +42mm' });
    expect(texts()).toContain('stacks +42mm');
  });
});
