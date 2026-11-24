export type ToolFamilyId = 'combinationWrench';
export type ToolUnits = 'metric' | 'sae';
export type ToolSetStyle = 'flat';

export const TOOL_FAMILY_IDS: readonly ToolFamilyId[] = ['combinationWrench'];
export const TOOL_UNITS: readonly ToolUnits[] = ['metric', 'sae'];
export const TOOL_SET_STYLES: readonly ToolSetStyle[] = ['flat'];

/**
 * What a tool set group was generated from, kept on the bin so "Edit set" can
 * rebuild the group. The tool list doubles as the record of what the bin holds.
 */
export interface ToolSetSpec {
  readonly family: ToolFamilyId;
  readonly units: ToolUnits;
  /** Size keys from the family's table, e.g. `13` or `1/2`. */
  readonly sizes: string[];
  readonly style: ToolSetStyle;
  readonly clearanceMm: number;
  /** Cap height of the engraved sizes; 0 leaves them off. */
  readonly labelSizeMm: number;
  readonly fingerChannel: boolean;
}

export const TOOL_SET_LIMITS = {
  maxSizes: 30,
  maxSizeKeyLength: 12,
  clearanceMm: { min: 0, max: 2 },
  labelSizeMm: { min: 0, max: 12 },
  /** Longest `Cutout.toolSetPart`: a role, a colon and a size key. */
  maxPartLength: 32,
} as const;

/**
 * Which part of its set a generated cutout is: `pocket:<size>`, `label:<size>`
 * or `channel`. A rebuild replaces only cutouts with a part, so a shape the
 * user dragged into the set survives it, and reuses each part's id, so
 * per-cutout state keyed by id (variant overrides, the selection) carries over.
 */
export type ToolSetPart = `pocket:${string}` | `label:${string}` | 'channel';

export function pocketPart(sizeKey: string): ToolSetPart {
  return `pocket:${sizeKey}`;
}

export function labelPart(sizeKey: string): ToolSetPart {
  return `label:${sizeKey}`;
}

export const DEFAULT_TOOL_SET_CLEARANCE_MM = 0.4;
export const DEFAULT_TOOL_SET_LABEL_MM = 5;
