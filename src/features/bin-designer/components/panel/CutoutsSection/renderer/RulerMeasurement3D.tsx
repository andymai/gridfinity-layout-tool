/**
 * Engineering-style dimension line for the ruler measurement tool.
 *
 * Renders in the R3F scene: perpendicular ticks at each endpoint,
 * a connecting line, and a centered HTML label showing distance + deltas.
 * All coordinates are in mm (world space).
 *
 * Uses drei's Line (Line2) for thick lines — WebGL's native lineWidth is
 * clamped to 1px on most platforms, making thin lines nearly invisible.
 */

import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import type { RulerMeasurement } from '../handlers/rulerHandler';
import { RENDER_ORDER } from './constants';

interface RulerMeasurement3DProps {
  readonly measurement: RulerMeasurement;
  readonly zoom: number;
}

/** Tick length in screen pixels (constant regardless of zoom) */
const TICK_LENGTH_PX = 12;
const RULER_Z = 0.05;
const RULER_COLOR = '#facc15'; // yellow-400 — high contrast on dark bin surface
const LINE_WIDTH_PX = 2.5;

export function RulerMeasurement3D({ measurement, zoom }: RulerMeasurement3DProps) {
  const { startX, startY, endX, endY, distance, deltaX, deltaY } = measurement;

  const { mainLine, startTick, endTick } = useMemo(() => {
    const tickMm = TICK_LENGTH_PX / zoom;
    const dx = endX - startX;
    const dy = endY - startY;
    const lenSq = dx * dx + dy * dy;

    // Perpendicular direction (normalized)
    let perpX: number;
    let perpY: number;
    if (lenSq < 0.000001) {
      perpX = 0;
      perpY = tickMm / 2;
    } else {
      const len = Math.sqrt(lenSq);
      const halfTick = tickMm / (2 * len);
      perpX = -dy * halfTick;
      perpY = dx * halfTick;
    }

    return {
      mainLine: [[startX, startY, RULER_Z] as const, [endX, endY, RULER_Z] as const],
      startTick: [
        [startX - perpX, startY - perpY, RULER_Z] as const,
        [startX + perpX, startY + perpY, RULER_Z] as const,
      ],
      endTick: [
        [endX - perpX, endY - perpY, RULER_Z] as const,
        [endX + perpX, endY + perpY, RULER_Z] as const,
      ],
    };
  }, [startX, startY, endX, endY, zoom]);

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  if (distance < 0.01) return null;

  return (
    <>
      <Line
        points={mainLine}
        color={RULER_COLOR}
        lineWidth={LINE_WIDTH_PX}
        transparent
        opacity={0.95}
        depthTest={false}
        renderOrder={RENDER_ORDER.SMART_GUIDES + 5}
      />
      <Line
        points={startTick}
        color={RULER_COLOR}
        lineWidth={LINE_WIDTH_PX}
        transparent
        opacity={0.95}
        depthTest={false}
        renderOrder={RENDER_ORDER.SMART_GUIDES + 5}
      />
      <Line
        points={endTick}
        color={RULER_COLOR}
        lineWidth={LINE_WIDTH_PX}
        transparent
        opacity={0.95}
        depthTest={false}
        renderOrder={RENDER_ORDER.SMART_GUIDES + 5}
      />

      {/* Measurement label */}
      <Html
        position={[midX, midY, RULER_Z]}
        center
        style={{ pointerEvents: 'none' }}
        renderOrder={RENDER_ORDER.HANDLES}
      >
        {/* eslint-disable i18next/no-literal-string -- measurement display, not translatable */}
        <div className="rounded bg-gray-900/95 px-2.5 py-1.5 text-xs font-mono text-yellow-200 whitespace-nowrap shadow-lg border border-yellow-500/40">
          <div className="font-semibold text-yellow-100">{distance.toFixed(1)}mm</div>
          {(Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) && (
            <div className="text-[10px] text-yellow-300/80">
              {'\u0394'}x: {Math.abs(deltaX).toFixed(1)} &nbsp; {'\u0394'}y:{' '}
              {Math.abs(deltaY).toFixed(1)}
            </div>
          )}
        </div>
        {/* eslint-enable i18next/no-literal-string */}
      </Html>
    </>
  );
}
