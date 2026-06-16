/**
 * Single source of truth for segmented-control styling across the bin designer.
 * Controls keep their own structure and ARIA semantics but pull their visual
 * treatment from here so the look can't drift.
 *
 * Two distinct visual systems live here:
 *
 * 1. Single-select segmentation (`SEGMENT_GROUP_CLASS` + `getSegmentClass`):
 *    a bordered track holding segments, where the selected segment is a raised
 *    neutral pill. Matches the global-nav ToolSwitcher so these read
 *    unmistakably as segmented controls rather than a loose row of chips.
 *
 * 2. Independent boolean toggles (`SEGMENT_ACTIVE` / `SEGMENT_INACTIVE`):
 *    bespoke on/off chips (scoop edge toggles, the eyedropper) where an accent
 *    tint is the clearer "this is on" signal than a neutral pill.
 *
 * Exception: PreviewControls (the toolbar floating over the 3D viewport)
 * deliberately keeps its own solid accent fill and toolbar-specific sizing
 * for contrast against arbitrary camera backgrounds, so it does not consume
 * this helper.
 */

export type SegmentSize = 'icon' | 'sm' | 'md';

const SEGMENT_BASE =
  'flex items-center justify-center gap-1.5 font-medium rounded-md transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

/** Selected segment inside a track: a raised neutral pill lifting off the recess. */
const SEGMENT_PILL_ACTIVE = 'bg-surface-elevated text-content shadow-sm';
// Deliberately equal to SEGMENT_INACTIVE: both systems share the same quiet
// "off" treatment, and only their *active* states differ (raised pill vs accent
// tint). Kept as distinct constants so each system can evolve independently —
// don't collapse them.
const SEGMENT_PILL_INACTIVE =
  'text-content-tertiary hover:bg-surface-hover hover:text-content-secondary';

/**
 * Accent on/off fragments — exported for bespoke independent toggles (scoop
 * edge chips, eyedropper) that supply their own dimensions and want an accent
 * "on" state rather than the neutral selected-pill look.
 */
export const SEGMENT_ACTIVE =
  'bg-accent/15 text-accent ring-1 ring-accent/40 hover:bg-accent/15 hover:text-accent';
export const SEGMENT_INACTIVE =
  'text-content-tertiary hover:bg-surface-hover hover:text-content-secondary';

/**
 * Container class for a single-select segment group: a bordered track that
 * reads unmistakably as a segmented control. Matches the global-nav
 * ToolSwitcher (bordered `bg-surface` track + raised `bg-surface-elevated`
 * active pill) so the two look like the same component.
 */
export const SEGMENT_GROUP_CLASS = 'flex rounded-lg border border-stroke-subtle bg-surface p-0.5';

const SIZE_CLASS: Record<SegmentSize, string> = {
  icon: 'p-1 text-[11px]',
  sm: 'px-1.5 py-1 text-[11px]',
  md: 'px-2 py-1 text-xs',
};

interface SegmentOptions {
  /** `md` = sidebar pickers (default); `sm` = compact label strips; `icon` = square icon-only buttons. */
  size?: SegmentSize;
}

export function getSegmentClass(isActive: boolean, opts: SegmentOptions = {}): string {
  const { size = 'md' } = opts;
  const state = isActive ? SEGMENT_PILL_ACTIVE : SEGMENT_PILL_INACTIVE;
  return `${SEGMENT_BASE} ${SIZE_CLASS[size]} ${state}`;
}
