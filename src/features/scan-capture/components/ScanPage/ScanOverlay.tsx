import { useMemo } from 'react';
import {
  interiorSeed,
  type ImageDataLike,
  type Point,
  type SceneShape,
  type SceneTrace,
} from '@/shared/scanTrace';

interface ScanOverlayProps {
  readonly image: ImageDataLike;
  readonly scene: SceneTrace;
  /** The tools to draw, in the order the list numbers them. */
  readonly shapes: readonly SceneShape[];
  readonly keepHoles: boolean;
}

/** Tool number badges, scaled to the photo so they read the same at any resolution. */
const badgeRadius = (image: ImageDataLike): number => Math.max(image.width, image.height) * 0.025;

const ring = (points: readonly Point[]): string =>
  `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`;

export function ScanOverlay({ image, scene, shapes, keepHoles }: ScanOverlayProps) {
  // Each badge sits where the tool is widest, so it never lands off the tool.
  const badges = useMemo(
    () =>
      shapes.length > 1
        ? shapes.map((shape) => {
            const at = interiorSeed(shape.imagePoints, image.width, image.height);
            return { x: at.x * image.width, y: at.y * image.height };
          })
        : [],
    [shapes, image]
  );
  const radius = badgeRadius(image);

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${image.width} ${image.height}`}
      preserveAspectRatio="none"
      fill="none"
    >
      {scene.card && (
        <polygon
          points={scene.card.corners.map((p) => `${p.x},${p.y}`).join(' ')}
          className="stroke-success"
          strokeWidth={2}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {scene.grid?.cells.map((cell, i) => (
        <polygon
          key={i}
          points={cell.map((p) => `${p.x},${p.y}`).join(' ')}
          className="stroke-success"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {shapes.map((shape, i) => (
        <path
          key={i}
          d={[
            shape.imagePoints,
            ...(keepHoles ? (shape.holes ?? []) : []).map((h) => h.imagePoints),
          ]
            .map(ring)
            .join(' ')}
          fillRule="evenodd"
          className="fill-accent/15 stroke-accent"
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {badges.map((at, i) => (
        <g key={i} aria-hidden="true">
          <circle cx={at.x} cy={at.y} r={radius} className="fill-accent" />
          <text
            x={at.x}
            y={at.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={radius * 1.2}
            className="fill-on-accent font-semibold"
          >
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
