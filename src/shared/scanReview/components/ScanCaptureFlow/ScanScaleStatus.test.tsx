import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SceneShape, SceneTrace } from '@/shared/scanTrace';
import { ScanScaleStatus } from './ScanScaleStatus';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const points = [
  { x: 0, y: 0 },
  { x: 80, y: 0 },
  { x: 80, y: 20 },
  { x: 0, y: 20 },
];
const TOOL: SceneShape = { imagePoints: points, outputPoints: points };
const corners = [points[0], points[1], points[2], points[3]] as const;

const scene = (over: Partial<SceneTrace>): SceneTrace => ({
  shapes: [TOOL],
  units: 'mm',
  card: null,
  grid: null,
  reference: null,
  ...over,
});

describe('ScanScaleStatus', () => {
  it.each([
    [
      'a plain sheet',
      { kind: 'paper', paper: { corners, widthMm: 297, heightMm: 210 } },
      'scan.paperMeasured',
    ],
    ['a card', { kind: 'card', card: { corners, fitness: 1 } }, 'scan.cardMeasured'],
  ] as const)('names %s as what sized the scan', (_name, reference, key) => {
    render(<ScanScaleStatus scene={scene({ reference })} shown={[TOOL]} cardSteep={false} />);
    expect(screen.getByText(key)).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.scanImport.resultSize')).toBeInTheDocument();
  });

  it('counts the tools when there are several', () => {
    render(<ScanScaleStatus scene={scene({})} shown={[TOOL, TOOL]} cardSteep={false} />);
    expect(screen.getByText('scan.review.toolsFound')).toBeInTheDocument();
  });

  it('says how to give an unsized scan a size', () => {
    render(<ScanScaleStatus scene={scene({ units: 'px' })} shown={[TOOL]} cardSteep={false} />);
    expect(screen.getByText('binDesigner.cutouts.traceView.scale.none')).toBeInTheDocument();
    expect(screen.getByText('scan.noReferenceHint')).toBeInTheDocument();
  });

  it('warns of a steep card', () => {
    render(<ScanScaleStatus scene={scene({})} shown={[TOOL]} cardSteep />);
    expect(screen.getByText('scan.cardSteepAngle')).toBeInTheDocument();
  });
});
