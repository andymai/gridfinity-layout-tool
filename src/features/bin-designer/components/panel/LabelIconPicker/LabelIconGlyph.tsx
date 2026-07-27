import { LABEL_ICON_PATHS } from '@/shared/constants/labelIconPaths';
import type { LabelPlateIconId } from '@/shared/constants/labelPlates';

export interface LabelIconGlyphProps {
  readonly icon: LabelPlateIconId;
  readonly size?: number;
  readonly className?: string;
}

/**
 * Renders an icon from the same path strings the generation worker extrudes,
 * so the picker can never show something the plate won't print.
 *
 * Holes come through as extra subpaths under `evenodd`, which is only a preview
 * convenience — the worker cuts them in 3D because the geometry kernel resolves
 * compound paths inconsistently. See `@/shared/constants/labelIconPaths`.
 *
 * Every silhouette is authored inside a ±5 box, so one shared viewBox frames
 * them all without measuring.
 */
export function LabelIconGlyph({ icon, size = 24, className }: LabelIconGlyphProps) {
  const def = LABEL_ICON_PATHS[icon];
  return (
    <svg
      viewBox="-6 -6 12 12"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d={[def.outline, ...(def.holes ?? [])].join(' ')}
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}
