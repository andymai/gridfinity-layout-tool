import type { LabelSocketStyle } from '@/shared/constants/labelPlates';
import type { TextStyleOverride } from './text';

/** Horizontal alignment of each label tab within its compartment column */
export type LabelTabAlignment = 'left' | 'center' | 'right';

/** Support structure style for the label tab */
export type LabelTabSupport = 'bracket' | 'solid' | 'fillet';

/**
 * Which compartment edges receive label tabs. 'back' (default) is the legacy
 * behavior. 'front' anchors tabs to the front wall instead, 'both' renders a
 * tab at each edge — the tuck-under-ledge use case from #1898.
 */
export type LabelTabEdges = 'back' | 'front' | 'both';

/**
 * What the label tab face carries: engraved/embossed text (legacy default)
 * or a click-in socket for swappable label plates (#2666). Socket geometry
 * follows the de-facto interchange standard pinned in
 * `@/shared/constants/labelPlates`, so separately printed plates transfer
 * between bins and ecosystem plates click in.
 */
export type LabelTabMode = 'text' | 'socket';

/** Label tab configuration for back-wall identification shelf */
export interface LabelTabConfig {
  readonly enabled: boolean;
  /**
   * Tab face mode. Absent = 'text' — the legacy engraved/embossed text
   * behavior, so existing saved designs are untouched.
   */
  readonly mode?: LabelTabMode;
  /**
   * Signed fit offset (mm) added to the TOTAL socket clearance in socket
   * mode, for per-printer fit calibration. Bounds
   * `[LABEL_PLATE_FIT_OFFSET_MIN, LABEL_PLATE_FIT_OFFSET_MAX]`; see
   * `effectiveLabelSocketClearance`.
   */
  readonly plateFitOffset?: number;
  /**
   * Socket profile in socket mode. Absent = 'clickIn' — the Cullenect
   * click-in pocket. 'slideChannel' swaps the retention ribs for overhanging
   * lips with a side mouth: the plate slides in from the compartment side
   * and parks behind a floor detent. Both styles take the same standard
   * plates.
   */
  readonly socketStyle?: LabelSocketStyle;
  /** Support structure: 'bracket' = open gussets, 'solid' = filled triangle */
  readonly support: LabelTabSupport;
  /** Depth of tab from inner back wall (horizontal inward), in mm */
  readonly depth: number;
  /** Width of each tab as percentage of compartment column width (1-100) */
  readonly width: number;
  /**
   * Z position of the shelf TOP above the cavity floor, in mm. When absent
   * (default), the shelf anchors to the wall top — identical to the original
   * label-tab behavior. Lowering this value drops the shelf down, creating a
   * tuck-under pocket between the stacking rim and the shelf (useful for
   * keeping springy contents from popping out — see issue #1898).
   *
   * Bounds enforced by the UI: `[tabDepth + 1, interiorHeight]`. The geometry
   * layer also guards against degenerate configs (returns null when the
   * gusset has no room).
   */
  readonly height?: number;
  /** Horizontal alignment within each compartment column */
  readonly alignment: LabelTabAlignment;
  /**
   * Which edges of each compartment receive tabs. When absent (default),
   * tabs anchor to the back wall — identical to the original behavior.
   * 'front' anchors to the front wall; 'both' renders a tab at each edge,
   * which is what the tuck-under-ledge use case from #1898 needs.
   *
   * For 'both' on a multi-row layout: each compartment with both a back
   * AND a front edge gets two tabs (mirroring how the existing back-tab
   * logic already places one tab per back-edge group, outer or interior).
   */
  readonly edges?: LabelTabEdges;
  /**
   * Distance in mm the tab moves INWARD from its anchor wall. For 'back',
   * positive `inset` moves toward the front; for 'front', positive moves
   * toward the back; for 'both', both tabs move inward symmetrically.
   *
   * Bounds: `[0, MAX_LABEL_TAB_INSET]`, with a runtime clamp based on the
   * compartment depth so the tab can't pass the opposite wall. When 'both'
   * tabs would collide (2·depth + 2·inset > compartmentDepth), the front
   * tab is silently dropped and the UI shows an inline warning.
   */
  readonly inset?: number;
  /**
   * Optional per-design style override for engraved compartment text on
   * label tabs. When omitted, `BinParams.textDefaults` apply unchanged.
   */
  readonly textStyle?: TextStyleOverride;
}
