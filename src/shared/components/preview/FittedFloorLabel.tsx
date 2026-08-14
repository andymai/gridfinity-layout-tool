/**
 * A floor-plane text label that fits itself to a horizontal band.
 *
 * Both 3D previews render this rather than their own `<Text>`, because the
 * props that make wrapped text read correctly — `textAlign`, `overflowWrap`,
 * the anchor — are the ones that silently drifted when the label existed as
 * two copies. Callers pass units and colour; they cannot pass those.
 *
 * Alignment: troika sets `maxLineWidth = maxWidth` once soft wrapping happens
 * and anchors the block on that, so `anchorX="center"` centres the *band*, not
 * the glyphs. Without `textAlign="center"` every wrapped label sits left of
 * where it looks like it should.
 *
 * Vertical: the block is anchored by its top, half a base line-height above
 * the caller's datum. A single line at the base size therefore lands exactly
 * where a middle-anchored one did, and extra lines grow downward into empty
 * floor instead of upward into the dimension drawing.
 */

import { Line, Text } from '@react-three/drei';
import { useCallback, useState } from 'react';
import { fitFloorLabel, type FloorLabelFit } from './fitFloorLabel';

/** Set explicitly so the top-anchor offset below is exact rather than font-dependent. */
const LINE_HEIGHT = 1.2;

interface TextRenderInfo {
  /** `[minX, minY, maxX, maxY]` of the block, which is the full band once wrapped. */
  blockBounds: readonly number[];
  /** `[minX, minY, maxX, maxY]` tight to the glyph paths — the widest rendered line. */
  visibleBounds: readonly number[];
}

interface TroikaTextMesh {
  textRenderInfo?: TextRenderInfo | null;
}

interface Ink {
  minX: number;
  maxX: number;
  bottom: number;
}

interface Measurement {
  key: string;
  fit: FloorLabelFit;
  ink: Ink | null;
}

export interface FloorLabelUnderline {
  /** Distance below the last line, in scene units. */
  gap: number;
  opacity: number;
}

export interface FittedFloorLabelProps {
  /** Rendered as given — the caller decides about case folding. */
  text: string;
  /** Horizontal room the label may occupy, in scene units. */
  band: number;
  baseFontSize: number;
  minFontSize: number;
  maxLines?: number;
  /** Centre of the first line at the base font size. */
  position: [number, number, number];
  color: string;
  fillOpacity: number;
  letterSpacing?: number;
  underline?: FloorLabelUnderline;
}

export function FittedFloorLabel({
  text,
  band,
  baseFontSize,
  minFontSize,
  maxLines = 2,
  position,
  color,
  fillOpacity,
  letterSpacing = 0,
  underline,
}: FittedFloorLabelProps) {
  const [measurement, setMeasurement] = useState<Measurement | null>(null);

  const key = [text, band, baseFontSize, minFontSize, maxLines].join('\u0000');
  const current = measurement?.key === key ? measurement : null;
  const wantsInk = underline !== undefined;

  const handleSync = useCallback(
    (mesh: TroikaTextMesh) => {
      const info = mesh.textRenderInfo;
      if (!info) return;

      setMeasurement((prev) => {
        if (prev?.key === key) {
          if (prev.ink || !wantsInk) return prev;
          const ink = readInk(info);
          return ink ? { ...prev, ink } : prev;
        }

        const naturalWidth = info.blockBounds[2] - info.blockBounds[0];
        if (!Number.isFinite(naturalWidth)) return prev;

        const fit = fitFloorLabel({
          text,
          naturalWidth,
          band,
          baseFontSize,
          minFontSize,
          maxLines,
        });

        // troika's sync() is a no-op when no layout input changed, so it will
        // never call back a second time for a fit that changes nothing. Read
        // the ink from this same pass or never get another chance at it.
        const settled =
          fit.fontSize === baseFontSize && fit.maxWidth === undefined && fit.text === text;

        return { key, fit, ink: settled && wantsInk ? readInk(info) : null };
      });
    },
    [key, text, band, baseFontSize, minFontSize, maxLines, wantsInk]
  );

  const topY = (baseFontSize * LINE_HEIGHT) / 2;
  const ink = current?.ink;

  return (
    <group position={position}>
      <Text
        position={[0, topY, 0]}
        fontSize={current?.fit.fontSize ?? baseFontSize}
        maxWidth={current?.fit.maxWidth}
        color={color}
        fillOpacity={current ? fillOpacity : 0}
        anchorX="center"
        anchorY="top"
        textAlign="center"
        overflowWrap="break-word"
        lineHeight={LINE_HEIGHT}
        letterSpacing={letterSpacing}
        onSync={handleSync}
      >
        {current?.fit.text ?? text}
      </Text>

      {underline && ink && (
        <Line
          points={[
            [ink.minX, topY + ink.bottom - underline.gap, 0],
            [ink.maxX, topY + ink.bottom - underline.gap, 0],
          ]}
          color={color}
          lineWidth={1}
          transparent
          opacity={underline.opacity}
        />
      )}
    </group>
  );
}

function readInk(info: TextRenderInfo): Ink | null {
  const minX = info.visibleBounds[0];
  const maxX = info.visibleBounds[2];
  const bottom = info.blockBounds[1];
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(bottom)) return null;
  if (maxX <= minX) return null;
  return { minX, maxX, bottom };
}
