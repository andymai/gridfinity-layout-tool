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

  // ── Style: solid ─────────────────────────────────────────────────────────
  {
    description: 'Solid style disables cavity features',
    source: 'style.solid',
    when: (p) => p.style === 'solid',
    disables: ['compartments', 'label', 'scoop', 'wallPattern', 'inserts', 'wallCutouts'],
    reason: 'binDesigner.solidDisablesCavity',
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
