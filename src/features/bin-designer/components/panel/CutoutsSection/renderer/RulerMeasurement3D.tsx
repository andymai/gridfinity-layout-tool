/**
 * Engineering-style dimension line for the ruler measurement tool.
 *
 * Renders in the R3F scene: perpendicular ticks at each endpoint,
 * a connecting line, and a centered HTML label showing distance + deltas.
 * All coordinates are in mm (world space).
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { RulerMeasurement } from '../handlers/rulerHandler';
import { RENDER_ORDER } from './constants';

interface RulerMeasurement3DProps {
  readonly measurement: RulerMeasurement;
  readonly zoom: number;
}

/** Tick length in screen pixels (constant regardless of zoom) */
const TICK_LENGTH_PX = 10;
const RULER_Z = 0.05;
const RULER_COLOR = new THREE.Color('#60a5fa'); // blue-400

export function RulerMeasurement3D({ measurement, zoom }: RulerMeasurement3DProps) {
  const { startX, startY, endX, endY, distance, deltaX, deltaY } = measurement;

  const geometry = useMemo(() => {
    const tickMm = TICK_LENGTH_PX / zoom;
    const dx = endX - startX;
    const dy = endY - startY;
    const lenSq = dx * dx + dy * dy;

    // Perpendicular direction (normalized)
    let perpX: number;
    let perpY: number;
    if (lenSq < 0.000001) {
      // len < 0.001 squared
      perpX = 0;
      perpY = tickMm / 2;
    } else {
      const len = Math.sqrt(lenSq);
      const halfTick = tickMm / (2 * len);
      perpX = -dy * halfTick;
      perpY = dx * halfTick;
    }

    const positions = new Float32Array([
      // Main line
      startX,
      startY,
      RULER_Z,
      endX,
      endY,
      RULER_Z,
      // Start tick (perpendicular)
      startX - perpX,
      startY - perpY,
      RULER_Z,
      startX + perpX,
      startY + perpY,
      RULER_Z,
      // End tick (perpendicular)
      endX - perpX,
      endY - perpY,
      RULER_Z,
      endX + perpX,
      endY + perpY,
      RULER_Z,
    ]);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [startX, startY, endX, endY, zoom]);

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  if (distance < 0.01) return null;

  return (
    <>
      <lineSegments geometry={geometry} renderOrder={RENDER_ORDER.SMART_GUIDES + 5}>
        <lineBasicMaterial color={RULER_COLOR} transparent opacity={0.9} depthTest={false} />
      </lineSegments>

      {/* Measurement label */}
      <Html
        position={[midX, midY, RULER_Z]}
        center
        style={{ pointerEvents: 'none' }}
        renderOrder={RENDER_ORDER.HANDLES}
      >
        {/* eslint-disable i18next/no-literal-string -- measurement display, not translatable */}
        <div className="rounded bg-blue-900/90 px-2 py-1 text-[11px] font-mono text-blue-200 whitespace-nowrap shadow-lg border border-blue-700/50">
          <div className="font-semibold text-blue-100">{distance.toFixed(1)}mm</div>
          {(Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) && (
            <div className="text-[10px] text-blue-300/80">
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
