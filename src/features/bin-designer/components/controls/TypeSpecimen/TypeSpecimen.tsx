/**
 * Flat specimen of the design's type, drawn from the real glyph outlines.
 *
 * Not a CSS preview: the outlines come from the same font buffer the kernel
 * extrudes and the positions from the same `planTypeBlock` the worker uses, so
 * face, case, tracking, line scale and anchoring are all shown as they will
 * print. A lookalike rendered in a web font would agree with the geometry only
 * by coincidence, and would stop agreeing the moment either side changed.
 *
 * Draws nothing until the face has loaded, and says so, rather than falling
 * back to an approximation the user would reasonably read as the answer.
 */

import { useTranslation } from '@/i18n';
import { planTypeBlock, planToPathData, resolveEffectiveFont } from '@/shared/utils/typePlan';
import type { TextStyleDefaults } from '@/shared/types/bin';
import { useTypeMeasurer } from '@/features/bin-designer/hooks/useTypeMeasurer';

/** Nominal host the specimen is planned against: a wall band's proportions. */
const SPECIMEN_W_MM = 64;
const SPECIMEN_D_MM = 20;

interface TypeSpecimenProps {
  readonly text: string;
  readonly style: TextStyleDefaults & { readonly fontSizeOverride?: number };
}

export function TypeSpecimen({ text, style }: TypeSpecimenProps) {
  const t = useTranslation();
  const family = resolveEffectiveFont(style.font, style.mode);
  const measurer = useTypeMeasurer([family]);

  const plan =
    measurer && text.trim() !== ''
      ? planTypeBlock(
          { text, style, host: { width: SPECIMEN_W_MM, depth: SPECIMEN_D_MM } },
          measurer
        )
      : null;
  const pathData = plan && measurer ? planToPathData(plan, measurer) : '';

  return (
    <div className="rounded-md border border-stroke-subtle bg-surface-secondary p-2">
      <svg
        role="img"
        aria-label={t('binDesigner.type.specimen')}
        viewBox={`${-SPECIMEN_W_MM / 2} ${-SPECIMEN_D_MM / 2} ${SPECIMEN_W_MM} ${SPECIMEN_D_MM}`}
        className="block h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* SVG's Y points down and the plan's points up; the flip belongs with
            the viewport, not with the geometry. */}
        <g transform="scale(1,-1)">
          {pathData !== '' && <path d={pathData} className="fill-content" />}
        </g>
      </svg>
      {pathData === '' && (
        <p className="mt-1 text-center text-label text-content-tertiary">
          {measurer === null
            ? t('binDesigner.type.specimenLoading')
            : t('binDesigner.type.specimenEmpty')}
        </p>
      )}
    </div>
  );
}
