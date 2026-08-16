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

import { isUndersideRelief, undersideReliefSelected } from '@/features/bin-designer/types/base';
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

  // ── Base: lid-compatible bottom ──────────────────────────────────
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
  // ── Lightweight: the three features an INTERIOR lite floor rules out ──────
  // Every pair below is mode-split. The interior mode opens the cavity floor
  // into the cups, which is what these features cannot survive; the underside
  // relief leaves the floor exactly as a standard bin has it, so it rules out
  // none of them (#3524). Inserts are the exception and stay mutual for both
  // modes — see below.
  //
  // The two directions read different predicates on purpose. The forward rules
  // ask whether the relief is BUILT (`isUndersideRelief`, which needs the
  // feature on). The reverse rules ask whether it is SELECTED, because they fire
  // while lightweight is still off: a bin with a finger scoop reaches the relief
  // only if choosing the mode is what makes the toggle available, and at that
  // moment the feature is off and `isUndersideRelief` is false.
  {
    description: 'Interior lightweight floor disables finger scoop (would bridge the recesses)',
    source: 'base.lightweight',
    when: (p) => p.base.lightweight && !isUndersideRelief(p.base),
    disables: ['scoop'],
    reason: 'binDesigner.lightweightDisablesScoop',
  },
  {
    description: 'Finger scoop incompatible with an interior lightweight floor',
    source: 'scoop',
    when: (p) => p.scoop.enabled && !undersideReliefSelected(p.base),
    disables: ['base.lightweight'],
    reason: 'binDesigner.scoopDisablesLightweight',
  },
  {
    description: 'Interior lightweight floor disables top cutouts',
    source: 'base.lightweight',
    when: (p) => p.base.lightweight && !isUndersideRelief(p.base),
    disables: ['cutouts'],
    reason: 'binDesigner.lightweightDisablesCutouts',
  },
  {
    // Cutouts only cut the floor in solid mode; the array persists as inert data
    // after switching back to a cavity style, so gate on `style === 'solid'` —
    // otherwise dormant cutouts would block re-selecting lightweight (and you
    // can't enable lightweight to clear them, a deadlock). Enabling lightweight
    // clears any leftover cutouts via the reverse rule above.
    //
    // A cutout can never reach the underside relief: `buildCutoutCuts` clamps
    // every pocket to `effectiveDepth = min(cutDepth, solidSurfaceZ)` and seats
    // it at `solidSurfaceZ - effectiveDepth`, so a pocket floor is >= Z=0 — the
    // socket top — whatever depth the user types, while the relief is entirely
    // below it. That clamp is what already stops a cutout breaching a standard
    // bin's feet.
    description: 'Cutouts incompatible with an interior lightweight floor (solid mode)',
    source: 'cutouts',
    when: (p) => p.style === 'solid' && p.cutouts.length > 0 && !undersideReliefSelected(p.base),
    disables: ['base.lightweight'],
    reason: 'binDesigner.cutoutsDisableLightweight',
  },
  // Inserts are the one pair that stays mutual across BOTH modes. They cut
  // recesses down into the interior floor, and the underside relief leaves that
  // floor a bare `wallThickness` with open air beneath it — so a recess there
  // does not thin the floor, it holes it. The interior mode has no floor to cut
  // at all. Neither mode can host them.
  {
    description: 'Lightweight floor disables floor inserts (would cut through the floor)',
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

  // ── Base: spacer ─────────────────────────────────────────────────
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

  // ── Base: base-only bin ─────────────────────────────────────────────────
  // The exact complement of the spacer: the floor and feet stay, the wall
  // collapses to zero, and the stacking lip fuses straight onto the floor slab.
  // Anything that lived on, in, or through a wall has no wall left to live on;
  // anything that needed interior depth has none. The lip and the colour zones
  // are the whole point of the mode and deliberately survive.
  {
    description: 'Base-only bin disables every wall-dependent feature',
    source: 'base.tile',
    when: (p) => p.base.tile === true,
    disables: ['wallPattern', 'wallCutouts', 'handles', 'slotConfig'],
    reason: 'binDesigner.tileDisablesWalls',
  },
  {
    // Split from the wall rule so the copy fits: a greyed-out compartment grid
    // needs "no depth to hold them", not "there is no wall".
    description: 'Base-only bin disables every depth-dependent interior feature',
    source: 'base.tile',
    when: (p) => p.base.tile === true,
    disables: ['compartments', 'label', 'scoop', 'floorPattern', 'inserts', 'cutouts'],
    reason: 'binDesigner.tileDisablesInterior',
  },
  {
    description: 'Base-only bin disables the interior styles (there is no interior to shape)',
    source: 'base.tile',
    when: (p) => p.base.tile === true,
    disables: ['style.slotted', 'style.solid'],
    reason: 'binDesigner.tileDisablesStyle',
  },
  {
    // A base-only bin IS feet + floor + lip. A spacer is feet + walls MINUS floor.
    // Together they cancel to nothing at all, so this pair is genuinely mutual
    // rather than the one-way mode switch the interior features get.
    // ONE-WAY on purpose. Both of these are booleans, so a reverse rule would
    // make each `when` true at once and the engine would flip-flop between
    // clearing one and clearing the other until MAX_ITERATIONS, leaving BOTH
    // set. (The spacer's mutual rules get away with it because their partners
    // are `base.style` VALUES, where one replacing the other is not a conflict
    // to resolve.) One rule covers both directions anyway: enabling base-only
    // clears the spacer, and while it is on this same rule reports
    // `base.spacer` unavailable so `toggleSpacer` refuses to turn it back on.
    description: 'Base-only bin incompatible with a spacer (nothing would remain)',
    source: 'base.tile',
    when: (p) => p.base.tile === true,
    disables: ['base.spacer'],
    reason: 'binDesigner.tileDisablesSpacer',
  },
  {
    // Split out of the spacer rule above, which bundled the two: an INTERIOR
    // lite floor opens the cavity floor into the cups, and a base-only bin's
    // body IS that floor — a `wallThickness` slab with nothing above it — so the
    // pair really does cancel to nothing.
    //
    // The underside relief does not: it takes material from beneath the slab and
    // leaves the slab whole. A tile is feet plus one thin plate, so it is the
    // shape that gains most from the relief, and refusing it here was an
    // accident of the bundling rather than a geometric limit (#3524).
    description: 'Base-only bin incompatible with an interior lightweight floor',
    source: 'base.tile',
    when: (p) => p.base.tile === true && !undersideReliefSelected(p.base),
    disables: ['base.lightweight'],
    reason: 'binDesigner.tileDisablesLightweight',
  },
  {
    // Mutual for the same reason the spacer's flat-base rule is: a socketless
    // plate has no feet, and feet are half of what a base-only bin is.
    description: 'Flat base incompatible with a base-only bin (no feet to stand on)',
    source: 'base.flat',
    when: (p) => p.base.style === 'flat',
    disables: ['base.tile'],
    reason: 'binDesigner.flatFloorDisablesTile',
  },
  {
    description: 'Lid-compatible bottom incompatible with a base-only bin (no feet to stand on)',
    source: 'base.lid',
    when: (p) => p.base.style === 'lid',
    disables: ['base.tile'],
    reason: 'binDesigner.lidBaseDisablesTile',
  },
  // Deliberately ONE-WAY from the interior features, exactly as the spacer is:
  // base-only is a mode switch that must stay reachable from a fully-designed
  // bin and clear the incompatible set on the way in. A reverse rule would grey
  // the toggle out and leave the user hand-clearing compartments, scoop, label,
  // handles and wall patterns first.

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

  // ── Floor pattern ────────────────────────────────────────────────
  // The interior mode replaces the solid floor + feet with shelled cups and
  // already opens the body floor into them, so there is no slab left to
  // perforate and no foot underside for the holes to exit through.
  //
  // The underside relief keeps the slab, and the cavity it opens vents straight
  // to the outside, so perforating it still drains. Mode-split like the pair
  // above, and for the same reason in each direction.
  {
    description: 'Interior lightweight floor disables the floor pattern (no slab to perforate)',
    source: 'base.lightweight',
    when: (p) => p.base.lightweight && !isUndersideRelief(p.base),
    disables: ['floorPattern'],
    reason: 'binDesigner.lightweightDisablesFloorPattern',
  },
  {
    description: 'Floor pattern incompatible with an interior lightweight floor',
    source: 'floorPattern',
    when: (p) => p.floorPattern?.enabled === true && !undersideReliefSelected(p.base),
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
