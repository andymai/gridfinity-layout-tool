import { mm, type Mm, type PaddingAnchor } from '@/core/types';
import {
  PADDING_MAX,
  PADDING_MIN,
  roundMm,
} from '@/features/baseplate/components/PaddingStepper/constants';

export interface AnchoredPaddings {
  readonly paddingLeft: Mm;
  readonly paddingRight: Mm;
  readonly paddingFront: Mm;
  readonly paddingBack: Mm;
  readonly clamped: boolean;
}

type ConcreteAnchor = Exclude<PaddingAnchor, 'custom'>;

const ANCHOR_START_WEIGHT: Record<ConcreteAnchor, { y: number; x: number }> = {
  tl: { y: 0, x: 0 },
  tc: { y: 0, x: 0.5 },
  tr: { y: 0, x: 1 },
  ml: { y: 0.5, x: 0 },
  c: { y: 0.5, x: 0.5 },
  mr: { y: 0.5, x: 1 },
  bl: { y: 1, x: 0 },
  bc: { y: 1, x: 0.5 },
  br: { y: 1, x: 1 },
};

// Integer-hundredths split keeps the 0.01mm leftover on the end side. With
// roundMm, IEEE-754 noise (e.g. 16.005 → 16.01) can flip the leftover to the
// start side, breaking the top-left rounding bias.
function splitAxis(total: number, startWeight: number): { start: number; end: number } {
  const totalCents = Math.round(Math.max(0, total) * 100);
  const startCents = Math.floor(totalCents * startWeight);
  return {
    start: roundMm(startCents / 100),
    end: roundMm((totalCents - startCents) / 100),
  };
}

function clampMm(v: number): number {
  return Math.max(PADDING_MIN, Math.min(PADDING_MAX, v));
}

interface PaddingSums {
  readonly paddingLeft: number;
  readonly paddingRight: number;
  readonly paddingFront: number;
  readonly paddingBack: number;
}

export function computeAnchoredPaddings(
  current: PaddingSums,
  anchor: ConcreteAnchor
): AnchoredPaddings {
  const weight = ANCHOR_START_WEIGHT[anchor];
  const y = splitAxis(current.paddingFront + current.paddingBack, weight.y);
  const x = splitAxis(current.paddingLeft + current.paddingRight, weight.x);

  const back = clampMm(y.start);
  const front = clampMm(y.end);
  const left = clampMm(x.start);
  const right = clampMm(x.end);

  return {
    paddingLeft: mm(left),
    paddingRight: mm(right),
    paddingFront: mm(front),
    paddingBack: mm(back),
    clamped: back !== y.start || front !== y.end || left !== x.start || right !== x.end,
  };
}
