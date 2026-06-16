/**
 * Hovering this row pins the whole-lip glow ('lip' hover target) for
 * the 3D preview — distinct from the per-corner sub-rows.
 */

import { ChevronDownIcon } from '@/design-system/Icon';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { HoverableZone, LipColorConfig } from '@/features/bin-designer/types/featureColors';

interface LipZoneRowProps {
  label: string;
  corners: LipColorConfig;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onHover: (zone: HoverableZone | null) => void;
  /** id of the region containing the 4 corner sub-rows (for aria-controls). */
  cornersId: string;
}

export function LipZoneRow({
  label,
  corners,
  isExpanded,
  onToggleExpand,
  onHover,
  cornersId,
}: LipZoneRowProps) {
  const t = useTranslation();
  return (
    <Button
      variant="ghost"
      type="button"
      onClick={onToggleExpand}
      onPointerEnter={() => onHover('lip')}
      onPointerLeave={() => onHover(null)}
      className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 -mx-2 transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40 md:py-1.5"
      aria-expanded={isExpanded}
      aria-controls={cornersId}
    >
      <span
        className="grid w-7 h-7 grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-md border border-stroke-subtle/60 bg-stroke-subtle/60 shrink-0 shadow-inner md:w-6 md:h-6"
        aria-hidden="true"
      >
        <span style={{ backgroundColor: corners.backLeft }} />
        <span style={{ backgroundColor: corners.backRight }} />
        <span style={{ backgroundColor: corners.frontLeft }} />
        <span style={{ backgroundColor: corners.frontRight }} />
      </span>
      <span className="flex flex-1 flex-col text-left leading-tight">
        <span className="text-xs font-normal text-content-secondary">{label}</span>
        <span className="text-[10px] font-normal text-content-tertiary">
          {t('binDesigner.colors.lip.fourCorners')}
        </span>
      </span>
      <ChevronDownIcon
        size="sm"
        className={`text-content-tertiary transition-transform ${isExpanded ? '' : '-rotate-90'}`}
      />
    </Button>
  );
}
