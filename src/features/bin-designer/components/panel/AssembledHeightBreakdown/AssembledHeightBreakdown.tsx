/**
 * Assembled-height readout under the Dimensions section.
 *
 * The W×D×H line above it is the bin's PRINTED body — what you check against a
 * print bed. This is what the design stands at once it is seated on a baseplate
 * with its lid on, which is the number drawer clearance actually depends on.
 * The two differ by more than the stacking lip, so both are labelled rather
 * than one silently replacing the other.
 */

import { Button } from '@/design-system';
import { ChevronDownIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { useAssembledHeight } from '@/features/bin-designer/hooks/useAssembledHeight';
import { ASSEMBLED_SEGMENT_LABEL_KEYS } from '@/shared/printSettings/assembledHeight';

/** Nearest 0.1mm, no trailing zeros — matches the drawer summary's formatting. */
function fmt(mm: number): string {
  return String(Math.round(mm * 10) / 10);
}

export function AssembledHeightBreakdown() {
  const t = useTranslation();
  const { breakdown, expanded, toggleExpanded, clearance } = useAssembledHeight();

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="ghost"
        onClick={toggleExpanded}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 px-1 py-1 text-xs"
      >
        <span className="flex items-center gap-1 text-content-tertiary">
          {t('assembledHeight.title')}
          <ChevronDownIcon
            size="xs"
            className={`transition-transform ${expanded ? '' : '-rotate-90'}`}
          />
        </span>
        <span className="tabular-nums text-content-secondary">{fmt(breakdown.totalMm)}mm</span>
      </Button>

      {expanded && (
        <dl className="space-y-0.5 pl-1 text-label text-content-tertiary">
          {breakdown.segments.map((segment) => (
            <div key={segment.kind}>
              <div className="flex items-baseline justify-between gap-2">
                <dt>{t(ASSEMBLED_SEGMENT_LABEL_KEYS[segment.kind])}</dt>
                <dd className="tabular-nums">{fmt(segment.mm)}mm</dd>
              </div>
              {/* The plate row is the counter-intuitive one: it usually reads
                  0mm because the bin's base drops into the pockets. Say so, or
                  it looks like a broken number. */}
              {segment.kind === 'baseplate' && breakdown.nestedMm > 0 && (
                <p className="text-micro text-content-tertiary/70">
                  {t('assembledHeight.nestedNote', {
                    plate: fmt(breakdown.baseplatePrintedMm),
                    nested: fmt(breakdown.nestedMm),
                  })}
                </p>
              )}
            </div>
          ))}
        </dl>
      )}

      {clearance && (
        <p
          className={`pl-1 text-label ${clearance.fits ? 'text-content-tertiary' : 'text-warning'}`}
        >
          {clearance.fits
            ? t('assembledHeight.fits', { slack: fmt(clearance.slackMm) })
            : t('assembledHeight.overflows', { over: fmt(-clearance.slackMm) })}
        </p>
      )}
    </div>
  );
}
