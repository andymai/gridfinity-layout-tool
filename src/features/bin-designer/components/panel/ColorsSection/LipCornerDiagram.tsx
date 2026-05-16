/**
 * Top-down orientation aid for the four lip-corner sub-rows. Hovering a
 * sub-row brightens the matching quadrant — gives the user a stable
 * reference for "which corner is back-right?" while the 3D preview is
 * rotating.
 */

import { useTranslation } from '@/i18n';
import type { HoverableZone, LipColorConfig } from '@/features/bin-designer/types/featureColors';

interface LipCornerDiagramProps {
  corners: LipColorConfig;
  hovered: HoverableZone | null;
}

const QUADRANTS: ReadonlyArray<{
  key: keyof LipColorConfig;
  zone: HoverableZone;
  x: number;
  y: number;
}> = [
  { key: 'backLeft', zone: 'lip:backLeft', x: 0, y: 0 },
  { key: 'backRight', zone: 'lip:backRight', x: 1, y: 0 },
  { key: 'frontLeft', zone: 'lip:frontLeft', x: 0, y: 1 },
  { key: 'frontRight', zone: 'lip:frontRight', x: 1, y: 1 },
];

export function LipCornerDiagram({ corners, hovered }: LipCornerDiagramProps) {
  const t = useTranslation();
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-12 h-12 shrink-0"
      role="img"
      aria-label={t('binDesigner.colors.lip.diagramAria')}
    >
      {QUADRANTS.map(({ key, zone, x, y }) => {
        const isHovered = hovered === zone || hovered === 'lip';
        return (
          <rect
            key={key}
            x={x * 11 + 1}
            y={y * 11 + 1}
            width={10}
            height={10}
            rx={2}
            fill={corners[key]}
            stroke="currentColor"
            strokeOpacity={isHovered ? 0.85 : 0.25}
            strokeWidth={isHovered ? 1.2 : 0.6}
            className="text-stroke transition-all"
          />
        );
      })}
    </svg>
  );
}
