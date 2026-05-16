/**
 * Hovering this row pins the whole-lip glow ('lip' hover target) for
 * the 3D preview — distinct from the per-corner sub-rows.
 */

import { ChevronDownIcon } from '@/design-system/Icon';
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
  return (
    <button
      type="button"
      onClick={onToggleExpand}
      onPointerEnter={() => onHover('lip')}
      onPointerLeave={() => onHover(null)}
      className="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40"
      aria-expanded={isExpanded}
      aria-controls={cornersId}
    >
      <span className="grid w-6 h-6 grid-cols-2 grid-rows-2 overflow-hidden rounded-md border border-stroke-subtle/60 shrink-0 shadow-inner">
        <span style={{ backgroundColor: corners.backLeft }} />
        <span style={{ backgroundColor: corners.backRight }} />
        <span style={{ backgroundColor: corners.frontLeft }} />
        <span style={{ backgroundColor: corners.frontRight }} />
      </span>
      <span className="flex-1 text-left text-xs text-content-secondary">{label}</span>
      <ChevronDownIcon
        size="sm"
        className={`text-content-tertiary transition-transform ${isExpanded ? '' : '-rotate-90'}`}
      />
    </button>
  );
}
