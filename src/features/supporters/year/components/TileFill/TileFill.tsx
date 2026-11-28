import { useLayoutEffect, useRef } from 'react';
import { roundRectPath } from '../../cards/paint';
import { CARD_H } from '../../cards/scene';
import { easeOut } from '../../look/motion';
import { tileColours } from '../../look/palettes';
import { TILE, tilePose, tileSpan } from '../../look/tiles';
import type { StoryTransition } from '../../utils/storyTimeline';
import { useFrameSize } from '../CardFrame';

export interface TileFillProps {
  readonly transition: StoryTransition | null;
  /** The colour of the card the fill brings in. */
  readonly background: string;
  readonly reduced: boolean;
}

/**
 * The cut between cards: a fill of 1×1 bins in the next card's colour, front
 * row first, then a quick fade off the new card. One canvas, drawn from the
 * story clock.
 */
export function TileFill({ transition, background, reduced }: TileFillProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useFrameSize();
  const phase = transition?.phase ?? null;
  const time = transition?.phase === 'fill' ? transition.time : 0;
  const length = transition?.phase === 'fill' ? transition.length : 1;
  // A dissolve only fades the finished fill, so it draws once and the canvas fades.
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas || !phase) return;
    const dpr = frame.scale > 0 ? frame.resolution / frame.scale : 1;
    const width = Math.max(1, Math.round(frame.width * dpr));
    const height = Math.max(1, Math.round(frame.height * dpr));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.setTransform(frame.resolution, 0, 0, frame.resolution, frame.left * dpr, frame.top * dpr);
    const colours = tileColours(background);
    const span = tileSpan(frame, CARD_H);
    const rows = span.r1 - span.r0 + 1;
    const cols = span.c1 - span.c0 + 1;
    for (let r = span.r0; r <= span.r1; r++) {
      for (let c = span.c0; c <= span.c1; c++) {
        const pose =
          phase === 'fill'
            ? tilePose(time, r - span.r0, rows, c - span.c0, cols, length, reduced)
            : { opacity: 1, y: 0, scale: 1 };
        if (pose.opacity <= 0.001) continue;
        const x = c * TILE;
        const y = CARD_H - (r + 1) * TILE;
        ctx.save();
        ctx.globalAlpha = pose.opacity;
        ctx.translate(x + TILE / 2, y + TILE / 2 + pose.y);
        ctx.scale(pose.scale, pose.scale);
        ctx.translate(-TILE / 2, -TILE / 2);
        // A hair wider than the tile, so no seam shows between neighbours.
        ctx.fillStyle = colours.rim;
        ctx.fillRect(-0.5, -0.5, TILE + 1, TILE + 1);
        ctx.beginPath();
        roundRectPath(ctx, 9, 9, TILE - 18, TILE - 18, 18);
        ctx.fillStyle = colours.floor;
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = colours.shade;
        ctx.fillRect(9, 9, TILE - 18, 13);
        ctx.restore();
        ctx.restore();
      }
    }
  }, [phase, time, length, background, reduced, frame]);
  const opacity = transition?.phase === 'dissolve' ? 1 - easeOut(transition.progress) : 1;
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      style={{ opacity, visibility: transition ? 'visible' : 'hidden' }}
    />
  );
}
