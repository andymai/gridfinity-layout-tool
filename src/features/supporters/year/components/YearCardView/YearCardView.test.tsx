import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { gridUnits, heightUnits } from '@/core/types';
import type { YearStats } from '../../types';
import type { YearCardKind } from '../../utils/yearCards';
import { YearCardView } from './YearCardView';

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
  longestPrint: { id: 'd1', name: 'Tool caddy', thumbnail: null, minutes: 580 },
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
    onRollCredits: vi.fn(),
    onSupport: vi.fn(),
    ...overrides,
  };
  render(<YearCardView {...props} />);
  return props;
}

describe('YearCardView', () => {
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
});
