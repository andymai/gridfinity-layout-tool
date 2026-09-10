/**
 * Cutout group actions: form and dissolve boolean groups, move units between
 * them, peel a group apart and edit a group's name or op. `set` is the
 * slice's wrapped setter, so an emptied lid array still collapses to absent.
 */

import type { Cutout, GroupOp } from '../../types';
import { DEFAULT_GROUP_OP, DEFAULT_CUTOUT_COLOR_SCOPE, MAX_GROUP_NAME_LENGTH } from '../../types';
import {
  adoptedGroupArray,
  dissolveSingletonGroups,
  pushHistoryEntry,
  withCutoutArray,
} from '../helpers';
import { generateLayoutId } from '@/shared/utils/uuid';
import {
  canNestDeeper,
  groupChain,
  insertGroupAt,
  isBooleanGroup,
  maxChainLength,
  parentGroups,
  removeGroup,
  sameChain,
  unitTag,
  unitTagGroupId,
  unitTags,
  withGroupChain,
} from '../../utils/cutoutHierarchy';
import { cutoutOwner, gcCutoutGroupNames, planUnitLandings } from './cutoutSliceHelpers';
import type { Set } from './cutoutSliceHelpers';

export function createCutoutGroupActions(set: Set) {
  return {
    groupCutouts: (cutoutIds: readonly string[], op?: GroupOp, context: readonly string[] = []) => {
      if (cutoutIds.length < 2) return;
      set((state) => {
        const owner = cutoutOwner(state);
        // Nothing may be created inside a boolean group. Its members are exactly
        // what its op fuses, so a group formed among them would silently reduce
        // that set — the one nesting move that could change existing geometry.
        if (context.length > 0 && isBooleanGroup(owner.cutouts, context[context.length - 1])) {
          return;
        }
        // Which things the selection reaches at this level. A group counts once
        // however many of its members are selected, so "two shapes of one group"
        // is one unit and correctly does nothing.
        const units = unitTags(
          owner.cutouts.filter((c) => cutoutIds.includes(c.id)),
          context
        );
        if (units.size < 2) return;

        // A selection reaching only loose shapes still forms a boolean group,
        // exactly as it did before nesting existed — that is what keeps Ctrl+G
        // then a Pathfinder op working. The moment it reaches a group, wrapping
        // is the only thing that preserves what is already there, so an explicit
        // op (a Pathfinder button) is the only way back to the flat behavior.
        if (op === undefined && [...units].some((tag) => unitTagGroupId(tag) !== null)) {
          const members = owner.cutouts.filter((c) => {
            const tag = unitTag(c, context);
            return tag !== null && units.has(tag);
          });
          if (!canNestDeeper(members)) return;
          const containerId = generateLayoutId();
          const memberIds = new Set(members.map((c) => c.id));
          pushHistoryEntry(state, { affectsGeometry: false });
          owner.cutouts = owner.cutouts.map((c) =>
            memberIds.has(c.id) ? insertGroupAt(c, containerId, context.length) : c
          );
          return;
        }
        // Reuse an existing groupId if any selected cutout already belongs to a group
        const existingMember = owner.cutouts.find(
          (c) => cutoutIds.includes(c.id) && c.groupId !== null
        );
        const existingGroupId = existingMember?.groupId ?? null;
        const groupId = existingGroupId ?? generateLayoutId();
        // When extending an existing group and the caller didn't override the op,
        // inherit the group's current op so silent regroups keep their semantics.
        const groupOp: GroupOp = op ?? existingMember?.groupOp ?? DEFAULT_GROUP_OP;
        const idsToGroup = new Set(cutoutIds);
        if (existingGroupId) {
          for (const c of owner.cutouts) {
            if (c.groupId === existingGroupId) idsToGroup.add(c.id);
          }
        }
        // One repeat per group, adopted the same way the color below is.
        const sharedArray = adoptedGroupArray(owner.cutouts, idsToGroup, existingGroupId);
        // One color per group: adopt the group's existing color, else the first
        // colored member, so a freshly grouped set can't hold mixed backings.
        const colorSource =
          (existingGroupId
            ? owner.cutouts.find((c) => c.groupId === existingGroupId && c.color !== undefined)
            : undefined) ??
          owner.cutouts.find((c) => idsToGroup.has(c.id) && c.color !== undefined);
        const colorPatch: Pick<Cutout, 'color' | 'colorScope'> | undefined = colorSource
          ? {
              color: colorSource.color,
              colorScope: colorSource.colorScope ?? DEFAULT_CUTOUT_COLOR_SCOPE,
            }
          : undefined;
        // Where the boolean group sits in the tree. An EXISTING group's own
        // position wins — folding shapes into it must move them to it, not drag
        // it out to wherever the caller was looking from.
        const destParents = existingMember ? parentGroups(existingMember) : context;
        const destChain = [...destParents, groupId];
        // Re-grouping a set that already forms this exact group changes nothing,
        // and an unconditional history push would spend an undo slot on it —
        // reachable from Ctrl+G on a partial selection of one group.
        const noChange = owner.cutouts.every(
          (c) =>
            !idsToGroup.has(c.id) ||
            (c.groupId === groupId &&
              (c.groupOp ?? DEFAULT_GROUP_OP) === groupOp &&
              c.array === sharedArray &&
              sameChain(groupChain(c), destChain) &&
              (!colorPatch ||
                (c.color === colorPatch.color &&
                  (c.colorScope ?? DEFAULT_CUTOUT_COLOR_SCOPE) === colorPatch.colorScope)))
        );
        if (noChange) return;

        pushHistoryEntry(state);
        owner.cutouts = owner.cutouts.map((c) =>
          idsToGroup.has(c.id)
            ? withCutoutArray(
                withGroupChain({ ...c, groupId, groupOp, ...colorPatch }, destChain),
                sharedArray
              )
            : c
        );
        gcCutoutGroupNames(state);
      });
    },

    ungroupCutouts: (cutoutIds: readonly string[]) => {
      set((state) => {
        pushHistoryEntry(state);
        const owner = cutoutOwner(state);
        const ungrouped = owner.cutouts.map((c) => {
          if (!cutoutIds.includes(c.id)) return c;
          const { groupOp: _omit, ...rest } = c;
          return { ...rest, groupId: null };
        });
        // A group can be left with a single member after a partial ungroup;
        // dissolve that singleton so the Pathfinder UI doesn't pretend a lone
        // cutout still belongs to an active group.
        owner.cutouts = dissolveSingletonGroups(ungrouped);
        gcCutoutGroupNames(state);
      });
    },

    /**
     * Move whole units — group rows and shape rows from the shape list — under
     * `destGroupId`, or to the top level when it is null.
     *
     * Takes {@link unitTag}s rather than cutout ids because the ids alone are
     * ambiguous: the members of a dragged group and three loose shapes that
     * happen to share a parent look identical as a flat id list, yet one has to
     * keep its own group on landing and the other must not gain one.
     */
    moveUnitsIntoGroup: (tags: readonly string[], destGroupId: string | null) => {
      if (tags.length === 0) return;
      set((state) => {
        const owner = cutoutOwner(state);
        const movingGroups = tags.map(unitTagGroupId).filter((id): id is string => id !== null);
        // A shape landing directly in a boolean group joins its boolean; every
        // other landing keeps whatever the cutout already was.
        const joinsBoolean =
          destGroupId !== null && isBooleanGroup(owner.cutouts, destGroupId) ? destGroupId : null;

        // A boolean group's members are exactly what its op fuses, so admitting
        // a subgroup would change what it carves without touching its own rows.
        if (joinsBoolean !== null && movingGroups.length > 0) return;

        let destChain: readonly string[] = [];
        if (destGroupId !== null) {
          const anchor = owner.cutouts.find((c) => groupChain(c).includes(destGroupId));
          if (!anchor) return;
          const anchorChain = groupChain(anchor);
          destChain = anchorChain.slice(0, anchorChain.indexOf(destGroupId) + 1);
        }
        // Landing a group inside itself, or anywhere in its own subtree, would
        // cut that branch loose.
        if (movingGroups.some((g) => destChain.includes(g))) return;

        const landings = planUnitLandings(owner.cutouts, tags, destChain);
        if (landings.size === 0) return;
        // Per landing, not one flat cap: a shape that lands loose stores its
        // whole chain in `parentGroups`, which the schema caps one lower.
        const overDepth = [...landings.values()].some(
          (l) => l.chain.length > maxChainLength({ groupId: l.keepsGroup ? 'kept' : null })
        );
        if (overDepth) return;

        const unchanged = owner.cutouts.every((c) => {
          const next = landings.get(c.id);
          return (
            next === undefined ||
            (sameChain(groupChain(c), next.chain) && next.keepsGroup === (c.groupId !== null))
          );
        });
        if (unchanged) return;

        pushHistoryEntry(state, { affectsGeometry: joinsBoolean !== null });
        const destOp =
          joinsBoolean === null
            ? DEFAULT_GROUP_OP
            : (owner.cutouts.find((c) => c.groupId === joinsBoolean)?.groupOp ?? DEFAULT_GROUP_OP);
        owner.cutouts = dissolveSingletonGroups(
          owner.cutouts.map((c) => {
            const landing = landings.get(c.id);
            if (landing === undefined) return c;
            if (landing.keepsGroup) return withGroupChain(c, landing.chain, true);
            // `destChain` already ends with the destination group, so a shape
            // joining a boolean group takes that chain as-is — appending the id
            // again would list it twice and make it its own ancestor.
            if (joinsBoolean !== null) {
              return withGroupChain(
                { ...c, groupId: joinsBoolean, groupOp: destOp },
                landing.chain,
                true
              );
            }
            // Leaving a boolean group takes its op along: a stale one on a now
            // loose shape would be adopted by whatever group it joins next.
            const { groupOp: _omit, ...bare } = c;
            return withGroupChain(bare, landing.chain, false);
          })
        );
        gcCutoutGroupNames(state);
      });
    },

    peelGroup: (groupId: string) => {
      set((state) => {
        const owner = cutoutOwner(state);
        if (!owner.cutouts.some((c) => groupChain(c).includes(groupId))) return;
        // Dissolving a container rearranges nothing the generator reads, but
        // dissolving a boolean group turns one fused cut tool back into several,
        // so only the latter is a geometry change.
        pushHistoryEntry(state, { affectsGeometry: isBooleanGroup(owner.cutouts, groupId) });
        const peeled = owner.cutouts.map((c) => {
          if (!groupChain(c).includes(groupId)) return c;
          // `groupOp` describes membership of the group being dissolved, so it
          // has to go with it — a stale op on a now-loose shape would be adopted
          // by whatever group the shape joins next.
          const next = removeGroup(c, groupId);
          if (c.groupId !== groupId) return next;
          const { groupOp: _omit, ...rest } = next;
          return rest;
        });
        owner.cutouts = dissolveSingletonGroups(peeled);
        gcCutoutGroupNames(state);
      });
    },

    setCutoutGroupName: (groupId: string, name: string) => {
      set((state) => {
        const trimmed = name.trim().slice(0, MAX_GROUP_NAME_LENGTH);
        const names = state.params.cutoutGroupNames ?? {};
        if ((names[groupId] ?? '') === trimmed) return;
        // Editor metadata only — a rename must never rebuild the mesh.
        pushHistoryEntry(state, { affectsGeometry: false });
        const next = Object.fromEntries(Object.entries(names).filter(([id]) => id !== groupId));
        if (trimmed !== '') next[groupId] = trimmed;
        state.params.cutoutGroupNames = Object.keys(next).length > 0 ? next : undefined;
      });
    },

    setGroupOp: (groupId: string, op: GroupOp) => {
      set((state) => {
        const owner = cutoutOwner(state);
        const hasMatchingGroup = owner.cutouts.some(
          (c) => c.groupId === groupId && (c.groupOp ?? DEFAULT_GROUP_OP) !== op
        );
        if (!hasMatchingGroup) return;
        pushHistoryEntry(state);
        owner.cutouts = owner.cutouts.map((c) =>
          c.groupId === groupId ? { ...c, groupOp: op } : c
        );
      });
    },
  };
}
