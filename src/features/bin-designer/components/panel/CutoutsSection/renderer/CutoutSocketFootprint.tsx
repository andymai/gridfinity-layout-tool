/**
 * The plate a cutout's socket will hold, drawn flat on the 2D editor surface.
 *
 * Shows the FOOTPRINT rather than the caption alone, because in socket mode
 * the thing being positioned is a 36–120mm part: a bare string would place
 * fine and then fail the plan's clear-space test with nothing on screen to
 * explain why. The caption size here is approximate (the exported plate
 * measures real glyph metrics through the kernel), so this reads as "a plate
 * of this size sits here", not as a proof of the printed layout.
 */

import { useMemo } from 'react';
import { Text } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { ICON_BAND_MM, roundedRectShape, socketCaptionLayout } from './cutoutSocketFootprintLayout';

const PLATE_OPACITY = 0.9;
const BORDER_OPACITY = 0.45;
/** Border width drawn as an oversized plane behind the plate (mm). */
const BORDER_MM = 0.5;

interface CutoutSocketFootprintProps {
  readonly centerX: number;
  readonly centerY: number;
  /** Plate-frame long axis (mm) — NOT world-swapped; `vertical` rotates. */
  readonly widthMm: number;
  /** Plate-frame short axis (mm). */
  readonly depthMm: number;
  readonly cornerRadiusMm: number;
  readonly text: string;
  readonly hasIcon: boolean;
  readonly vertical: boolean;
  readonly fill: string;
  readonly textColor: string;
  /** Start a free-nudge drag from a world-mm grab point. */
  readonly onPointerDown?: (mmX: number, mmY: number) => void;
}

export function CutoutSocketFootprint({
  centerX,
  centerY,
  widthMm,
  depthMm,
  cornerRadiusMm,
  text,
  hasIcon,
  vertical,
  fill,
  textColor,
  onPointerDown,
}: CutoutSocketFootprintProps) {
  const plate = useMemo(
    () => roundedRectShape(widthMm, depthMm, cornerRadiusMm),
    [widthMm, depthMm, cornerRadiusMm]
  );
  const border = useMemo(
    () =>
      roundedRectShape(
        widthMm + 2 * BORDER_MM,
        depthMm + 2 * BORDER_MM,
        cornerRadiusMm + BORDER_MM
      ),
    [widthMm, depthMm, cornerRadiusMm]
  );

  // Extents arrive in the PLATE's own frame (width = long axis); the group
  // rotation below is the single place orientation is applied, so the caption
  // always lays out along local X.
  const plateLength = widthMm;
  const { fontSize, captionSpan, captionCenter, iconCenter } = socketCaptionLayout(
    plateLength,
    hasIcon,
    text
  );
  const trimmed = text.trim();

  const handlePointerDown = onPointerDown
    ? (e: ThreeEvent<PointerEvent>) => {
        if (e.nativeEvent.button !== 0) return;
        e.stopPropagation();
        onPointerDown(e.point.x, e.point.y);
      }
    : undefined;

  return (
    <group position={[centerX, centerY, 0.05]} rotation={[0, 0, vertical ? Math.PI / 2 : 0]}>
      <mesh position={[0, 0, -0.002]}>
        <shapeGeometry args={[border]} />
        <meshBasicMaterial color={textColor} transparent opacity={BORDER_OPACITY} />
      </mesh>
      <mesh onPointerDown={handlePointerDown}>
        <shapeGeometry args={[plate]} />
        <meshBasicMaterial color={fill} transparent opacity={PLATE_OPACITY} />
      </mesh>
      {hasIcon && (
        <mesh position={[iconCenter, 0, 0.002]}>
          <shapeGeometry args={[roundedRectShape(ICON_BAND_MM, ICON_BAND_MM, 1)]} />
          <meshBasicMaterial color={textColor} transparent opacity={0.3} />
        </mesh>
      )}
      {fontSize > 0 && (
        <Text
          position={[captionCenter, 0, 0.003]}
          fontSize={fontSize}
          color={textColor}
          anchorX="center"
          anchorY="middle"
          maxWidth={captionSpan}
        >
          {trimmed}
        </Text>
      )}
    </group>
  );
}
