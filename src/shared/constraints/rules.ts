/**
 * Centralized constraint rule registry.
 *
 * ALL feature incompatibilities and derived-state implications
 * MUST be declared here. This is the single source of truth
 * consumed by both the UI (disabled reasons) and generation (guards).
 *
 * Adding a new constraint: append to CONSTRAINT_RULES or IMPLICATION_RULES.
 * Adding a new feature: add a FeatureKey in types.ts, a manifest in features.ts,
 * and any constraint rules here.
 */

import type { ConstraintRule, ImplicationRule } from './types';

export const CONSTRAINT_RULES: readonly ConstraintRule[] = [
  // ── Base: flat ↔ everything else ─────────────────────────────────────────
  {
    description: 'Flat base disables attachment features',
    source: 'base.flat',
    when: (p) => p.base.style === 'flat',
    disables: ['base.magnet', 'base.screw'],
    reason: 'binDesigner.flatFloorDisablesAttachment',
  },
  {
    description: 'Flat base disables half sockets',
    source: 'base.flat',
    when: (p) => p.base.style === 'flat',
    disables: ['base.halfSockets'],
    reason: 'binDesigner.flatFloorDisablesHalfSockets',
  },
  {
    description: 'Half sockets incompatible with flat floor',
    source: 'base.halfSockets',
    when: (p) => p.base.halfSockets,
    disables: ['base.flat'],
    reason: 'binDesigner.halfSocketsDisablesFlatFloor',
  },
  {
    description: 'Flat base disables lightweight (no socket floor to shell)',
    source: 'base.flat',
    when: (p) => p.base.style === 'flat',
    disables: ['base.lightweight'],
    reason: 'binDesigner.flatFloorDisablesLightweight',
  },
  {
    description: 'Lightweight incompatible with flat floor',
    source: 'base.lightweight',
    when: (p) => p.base.lightweight,
    disables: ['base.flat'],
    reason: 'binDesigner.lightweightDisablesFlatFloor',
  },
  {
    description: 'Lightweight floor disables finger scoop (would bridge the recesses)',
    source: 'base.lightweight',
    when: (p) => p.base.lightweight,
    disables: ['scoop'],
    reason: 'binDesigner.lightweightDisablesScoop',
  },
  {
    description: 'Finger scoop incompatible with lightweight floor',
    source: 'scoop',
    when: (p) => p.scoop.enabled,
    disables: ['base.lightweight'],
    reason: 'binDesigner.scoopDisablesLightweight',
  },
  {
    description: 'Lightweight floor disables top cutouts',
    source: 'base.lightweight',
    when: (p) => p.base.lightweight,
    disables: ['cutouts'],
    reason: 'binDesigner.lightweightDisablesCutouts',
  },
  {
    // Cutouts only cut the floor in solid mode; the array persists as inert data
    // after switching back to a cavity style, so gate on `style === 'solid'` —
    // otherwise dormant cutouts would block re-selecting lightweight (and you
    // can't enable lightweight to clear them, a deadlock). Enabling lightweight
    // clears any leftover cutouts via the reverse rule above.
    description: 'Cutouts incompatible with lightweight floor (solid mode)',
    source: 'cutouts',
    when: (p) => p.style === 'solid' && p.cutouts.length > 0,
    disables: ['base.lightweight'],
    reason: 'binDesigner.cutoutsDisableLightweight',
  },
  {
    description: 'Lightweight floor disables floor inserts (would cut through the shell)',
    source: 'base.lightweight',
    when: (p) => p.base.lightweight,
    disables: ['inserts'],
    reason: 'binDesigner.lightweightDisablesInserts',
  },
  {
    description: 'Floor inserts incompatible with lightweight floor',
    source: 'inserts',
    when: (p) => p.inserts.length > 0,
    disables: ['base.lightweight'],
    reason: 'binDesigner.insertsDisableLightweight',
  },
  {
    description: 'Attachment holes incompatible with flat floor',
    source: 'base.magnet',
    when: (p) => p.base.style === 'magnet' || p.base.style === 'magnet_and_screw',
    disables: ['base.flat'],
    reason: 'binDesigner.attachmentDisablesFlatFloor',
  },
  {
    description: 'Attachment holes incompatible with flat floor',
    source: 'base.screw',
    when: (p) => p.base.style === 'screw' || p.base.style === 'magnet_and_screw',
    disables: ['base.flat'],
    reason: 'binDesigner.attachmentDisablesFlatFloor',
  },

  // ── Style: slotted ───────────────────────────────────────────────────────
  {
    description: 'Slotted style disables compartments',
    source: 'style.slotted',
    when: (p) => p.style === 'slotted',
    disables: ['compartments'],
    reason: 'binDesigner.compartmentsUnavailableSlotted',
  },
  {
    description: 'Slotted style disables label tabs',
    source: 'style.slotted',
    when: (p) => p.style === 'slotted',
    disables: ['label'],
    reason: 'binDesigner.labelTabsUnavailableSlotted',
  },
  {
    description: 'Slotted style disables finger scoop',
    source: 'style.slotted',
    when: (p) => p.style === 'slotted',
    disables: ['scoop'],
    reason: 'binDesigner.fingerScoopUnavailableSlotted',
  },
  {
    description: 'Slotted bins cannot have handles',
    source: 'style.slotted',
    when: (p) => p.style === 'slotted',
    disables: ['handles'],
    reason: 'binDesigner.handles.unavailableSlotted',
  },

  // ── Base: spacer (#2869) ─────────────────────────────────────────────────
  // A spacer is a floorless riser: the floor is punched through every cell so
  // only the shelled feet and the webbing between them remain. Nothing that
  // needs a floor to sit on, cut into, or perforate can come along.
  {
    description: 'Spacer disables every floor-dependent feature',
    source: 'base.spacer',
    when: (p) => p.base.spacer,
    disables: [
      'compartments',
      'label',
      'scoop',
      'floorPattern',
      'inserts',
      'cutouts',
      'slotConfig',
      'style.slotted',
      'style.solid',
    ],
    reason: 'binDesigner.spacerDisablesInterior',
  },
  {
    description: 'Spacer disables attachment hardware (no floor for a magnet pad)',
    source: 'base.spacer',
    when: (p) => p.base.spacer,
    disables: ['base.magnet', 'base.screw'],
    reason: 'binDesigner.spacerDisablesAttachment',
  },
  {
    description: 'Spacer disables the flat base (nothing to shell through) and lite (implied)',
    source: 'base.spacer',
    when: (p) => p.base.spacer,
    disables: ['base.flat', 'base.lightweight'],
    reason: 'binDesigner.spacerDisablesBase',
  },
  {
    description: 'Interior features incompatible with a spacer',
    source: 'compartments',
    when: (p) => p.compartments.cols > 1 || p.compartments.rows > 1,
    disables: ['base.spacer'],
    reason: 'binDesigner.interiorDisablesSpacer',
  },
  {
    description: 'Scoop incompatible with a spacer',
    source: 'scoop',
    when: (p) => p.scoop.enabled,
    disables: ['base.spacer'],
    reason: 'binDesigner.interiorDisablesSpacer',
  },
  {
    description: 'Label tabs incompatible with a spacer',
    source: 'label',
    when: (p) => p.label.enabled,
    disables: ['base.spacer'],
    reason: 'binDesigner.interiorDisablesSpacer',
  },
  {
    description: 'Floor pattern incompatible with a spacer (no slab to perforate)',
    source: 'floorPattern',
    when: (p) => p.floorPattern?.enabled === true,
    disables: ['base.spacer'],
    reason: 'binDesigner.interiorDisablesSpacer',
  },
  {
    description: 'Flat base incompatible with a spacer (no socket to shell through)',
    source: 'base.flat',
    when: (p) => p.base.style === 'flat',
    disables: ['base.spacer'],
    reason: 'binDesigner.flatFloorDisablesSpacer',
  },
  {
    description: 'Slotted style incompatible with a spacer',
    source: 'style.slotted',
    when: (p) => p.style === 'slotted',
    disables: ['base.spacer'],
    reason: 'binDesigner.interiorDisablesSpacer',
  },
  {
    description: 'Solid style incompatible with a spacer',
    source: 'style.solid',
    when: (p) => p.style === 'solid',
    disables: ['base.spacer'],
    reason: 'binDesigner.interiorDisablesSpacer',
  },

  // ── Style: solid ─────────────────────────────────────────────────────────
  {
    description: 'Solid style disables cavity features',
    source: 'style.solid',
    when: (p) => p.style === 'solid',
    disables: [
      'compartments',
      'label',
      'scoop',
      'wallPattern',
      'floorPattern',
      'inserts',
      'wallCutouts',
      'handles',
    ],
    reason: 'binDesigner.solidDisablesCavity',
  },

  // ── Floor pattern (#2816) ────────────────────────────────────────────────
  // The lightweight base replaces the solid floor + feet with shelled cups and
  // already opens the body floor into them, so there is no slab left to
  // perforate and no foot underside for the holes to exit through.
  {
    description: 'Lightweight floor disables the floor pattern (no slab to perforate)',
    source: 'base.lightweight',
    when: (p) => p.base.lightweight,
    disables: ['floorPattern'],
    reason: 'binDesigner.lightweightDisablesFloorPattern',
  },
  {
    description: 'Floor pattern incompatible with lightweight floor',
    source: 'floorPattern',
    when: (p) => p.floorPattern?.enabled === true,
    disables: ['base.lightweight'],
    reason: 'binDesigner.floorPatternDisablesLightweight',
  },

  // ── Dynamic: wall pattern disabled when all walls are slotted ────────────
  {
    description: 'Wall patterns disabled when all walls have divider slots',
    source: 'slotConfig',
    when: (p) => p.style === 'slotted' && p.slotConfig.x.enabled && p.slotConfig.y.enabled,
    disables: ['wallPattern'],
    reason: 'binDesigner.walls.pattern.allSlotted',
  },

  // ── Style mutual exclusion: slotted ↔ solid ─────────────────────────────
  {
    description: 'Slotted and solid styles are mutually exclusive',
    source: 'style.slotted',
    when: (p) => p.style === 'slotted',
    disables: ['style.solid'],
    reason: 'binDesigner.stylesMutuallyExclusive',
  },
  {
    description: 'Slotted and solid styles are mutually exclusive',
    source: 'style.solid',
    when: (p) => p.style === 'solid',
    disables: ['style.slotted'],
    reason: 'binDesigner.stylesMutuallyExclusive',
  },
] as const;

export const IMPLICATION_RULES: readonly ImplicationRule[] = [
  {
    description: 'Solid style forces base.solid=true',
    when: (p) => p.style === 'solid' && !p.base.solid,
    apply: (p) => ({ base: { ...p.base, solid: true } }),
  },
  {
    description: 'Non-solid style clears base.solid',
    when: (p) => p.style !== 'solid' && p.base.solid,
    apply: (p) => ({ base: { ...p.base, solid: false } }),
  },
] as const;
