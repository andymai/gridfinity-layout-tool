/**
 * Single source of truth for segmented-control button styling across the
 * bin designer. Controls keep their own structure and ARIA semantics but
 * pull their visual treatment from here so the look can't drift.
 *
 * Active state is a subtle accent tint with a crisp ring.
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

/** Color fragments — exported for bespoke-sized chips that supply their own dimensions. */
export const SEGMENT_ACTIVE = 'bg-accent/15 text-accent ring-1 ring-accent/40';
export const SEGMENT_INACTIVE =
  'text-content-tertiary hover:bg-surface-hover hover:text-content-secondary';

/** Container class for a horizontal segment group. */
export const SEGMENT_GROUP_CLASS = 'flex gap-1';

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
  const state = isActive ? SEGMENT_ACTIVE : SEGMENT_INACTIVE;
  return `${SEGMENT_BASE} ${SIZE_CLASS[size]} ${state}`;
}
