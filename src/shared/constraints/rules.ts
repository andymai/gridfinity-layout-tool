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

  // ── Base: lid-compatible bottom (#3036) ──────────────────────────────────
  // Lid mating geometry underneath means no socket and no feet, so this rules
  // out the same set the flat base does. `base.flat` itself needs no rule: both
  // are values of `base.style`, so one replacing the other is not a conflict
  // for the engine to resolve.
  {
    description: 'Lid-compatible bottom disables attachment features (no feet to drill)',
    source: 'base.lid',
    when: (p) => p.base.style === 'lid',
    disables: ['base.magnet', 'base.screw'],
    reason: 'binDesigner.lidBaseDisablesAttachment',
  },
  {
    description: 'Lid-compatible bottom disables half sockets (there are no sockets)',
    source: 'base.lid',
    when: (p) => p.base.style === 'lid',
    disables: ['base.halfSockets'],
    reason: 'binDesigner.lidBaseDisablesHalfSockets',
  },
  {
    description: 'Lid-compatible bottom disables lightweight and spacer (no socket to shell)',
    source: 'base.lid',
    when: (p) => p.base.style === 'lid',
    disables: ['base.lightweight', 'base.spacer'],
    reason: 'binDesigner.lidBaseDisablesShelling',
  },
  {
    description: 'Half sockets incompatible with a lid-compatible bottom',
    source: 'base.halfSockets',
    when: (p) => p.base.halfSockets,
    disables: ['base.lid'],
    reason: 'binDesigner.halfSocketsDisablesLidBase',
  },
  {
    description: 'Lightweight incompatible with a lid-compatible bottom',
    source: 'base.lightweight',
    when: (p) => p.base.lightweight,
    disables: ['base.lid'],
    reason: 'binDesigner.lightweightDisablesLidBase',
  },
  {
    description: 'Spacer incompatible with a lid-compatible bottom (nothing to shell through)',
    source: 'base.spacer',
    when: (p) => p.base.spacer,
    disables: ['base.lid'],
    reason: 'binDesigner.spacerDisablesLidBase',
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
    disables: ['compartments', 'label', 'scoop', 'floorPattern', 'inserts', 'cutouts'],
    reason: 'binDesigner.spacerDisablesInterior',
  },
  {
    // Split from the rule above so the copy fits: "no floor to hold interior
    // features" reads wrong next to a greyed-out wall STYLE.
    description: 'Spacer disables the interior styles (it has no interior to shape)',
    source: 'base.spacer',
    when: (p) => p.base.spacer,
    disables: ['slotConfig', 'style.slotted', 'style.solid'],
    reason: 'binDesigner.spacerDisablesStyle',
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
  // Deliberately ONE-WAY from the interior features: a spacer is a mode switch, so
  // it must stay reachable from a fully-designed bin and clear the incompatible
  // set on the way in (the `style.solid` precedent). A reverse rule would grey the
  // toggle out and leave the user hand-clearing compartments, scoop and label
  // first. Only the flat base blocks it, and that is genuinely mutual — a plate
  // with no feet has nothing for the spacer to open through.
  {
    description: 'Flat base incompatible with a spacer (no feet to open through)',
    source: 'base.flat',
    when: (p) => p.base.style === 'flat',
    disables: ['base.spacer'],
    reason: 'binDesigner.flatFloorDisablesSpacer',
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
