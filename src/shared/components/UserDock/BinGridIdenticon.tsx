import { useMemo } from 'react';
import { identiconFromSeed, identiconCellColor, IDENTICON_GRID } from './identicon';

interface BinGridIdenticonProps {
  seed: string;
  size?: number;
  muted?: boolean;
  /** Override the seed-derived hue, e.g. a collaborator's session color. */
  hueOverride?: number;
}

const PAD = 10;
const GAP = 6;
const CELL = (100 - PAD * 2 - GAP * (IDENTICON_GRID - 1)) / IDENTICON_GRID;
const RADIUS = 4;
const EMPTY_FILL = 'var(--color-stroke-subtle)';
const EMPTY_OPACITY = 0.3;

export function BinGridIdenticon({
  seed,
  size = 28,
  muted = false,
  hueOverride,
}: BinGridIdenticonProps) {
  const { cells, hue: seedHue } = useMemo(() => identiconFromSeed(seed), [seed]);
  const hue = hueOverride ?? seedHue;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="flex-none">
      {cells.map((filled, i) => {
        const row = Math.floor(i / IDENTICON_GRID);
        const col = i % IDENTICON_GRID;
        return (
          <rect
            key={i}
            x={PAD + col * (CELL + GAP)}
            y={PAD + row * (CELL + GAP)}
            width={CELL}
            height={CELL}
            rx={RADIUS}
            fill={filled ? identiconCellColor(hue, row, muted) : EMPTY_FILL}
            fillOpacity={filled ? 1 : EMPTY_OPACITY}
          />
        );
      })}
    </svg>
  );
}
