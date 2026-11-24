import type { BinParams } from '@/features/bin-designer/types';

/** Mark every visible "Scan a tool" and "Add a tool set" entry in the panel. */
export const SCAN_TOOL_TARGET = 'bd-scan-tool';
export const TOOL_SET_TARGET = 'bd-tool-set';

/**
 * The panel state a control's availability depends on. A control whose section
 * is not currently mounted is left out of results so a jump never dead-ends on
 * the dispatcher's silent 2s timeout.
 */
export interface ControlAvailabilityContext {
  readonly style: BinParams['style'];
  readonly hasText: boolean;
  /** The scroll panel mounts its bed-fit section (`useSplitOptionsSection`). */
  readonly bedFitShown: boolean;
  readonly viewMode: 'scroll' | 'rail';
  /** The `sliding_tray` labs flag — the slide-tray section only mounts when on. */
  readonly slideTrayEnabled: boolean;
  /** A bin that can take cutouts: when a "Scan a tool" entry renders. */
  readonly scanAvailable: boolean;
  /** {@link scanAvailable} on desktop: when an "Add a tool set" entry renders. */
  readonly toolSetAvailable: boolean;
}

/**
 * The conditionally-mounted controls; everything else has an always-mounted
 * marker. Label tabs need a standard style; typography needs text on the bin;
 * the slide tray is behind a labs flag; print-fit is view-dependent (the rail's
 * PrintPage always renders it, passive when the bin fits, the scroll panel only
 * when the bin overruns the bed or its split switch is off).
 */
export function isDesignerControlAvailable(
  controlId: string,
  ctx: ControlAvailabilityContext
): boolean {
  switch (controlId) {
    case 'bd-label-tabs':
      return ctx.style === 'standard';
    case 'bd-type':
      return ctx.hasText;
    case 'bd-slide-tray':
      return ctx.slideTrayEnabled;
    case 'bd-print-fit':
      return ctx.viewMode === 'rail' || ctx.bedFitShown;
    case SCAN_TOOL_TARGET:
      return ctx.scanAvailable;
    case TOOL_SET_TARGET:
      return ctx.toolSetAvailable;
    default:
      return true;
  }
}
