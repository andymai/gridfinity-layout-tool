import { Badge } from '@/design-system';
import { cn } from '@/design-system/cn';
import { useTranslation } from '@/i18n';
import { WARNING_ICON } from './binConstants';
import type { BinBedFit } from './useBinBedFit';

interface BinOverBedChipProps {
  bedFit: Exclude<BinBedFit, 'fits'>;
  /** Scales with the grid zoom, like the bin's own text. */
  fontSize: number;
  /** The mark alone, beside the dimensions when a label takes the main line. */
  iconOnly?: boolean;
  className?: string;
}

/**
 * Marks a bin larger than the print bed. The overlay tone paints its own dark
 * ground: the chip sits on the category colour, which can be any colour, so
 * neither the warning colour nor the bin's text colour reads on every bin.
 */
export function BinOverBedChip({
  bedFit,
  fontSize,
  iconOnly = false,
  className,
}: BinOverBedChipProps) {
  const t = useTranslation();
  const keptWhole = bedFit === 'keptWhole';
  const title = t(keptWhole ? 'grid.exceedsPrintSizeWhole' : 'grid.exceedsPrintSize');
  return (
    <Badge
      tone="overlay"
      data-over-bed={bedFit}
      title={title}
      aria-label={iconOnly ? title : undefined}
      className={cn('gap-[0.2em]', className)}
      style={{ fontSize: `${fontSize}px`, padding: '0.15em 0.3em', textShadow: 'none' }}
    >
      {/* U+FE0E keeps the sign a text glyph in the chip colour, not a colour emoji. */}
      <span aria-hidden="true">{`${WARNING_ICON}\uFE0E`}</span>
      {!iconOnly && <span>{t(keptWhole ? 'grid.oversized' : 'grid.split')}</span>}
    </Badge>
  );
}
