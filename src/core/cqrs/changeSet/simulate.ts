import { produce } from 'immer';
import type { Draft } from 'immer';
import * as z from 'zod';
import { CATEGORY_COLOR_PALETTE, STAGING_ID } from '@/core/constants';
import { err, isErr, ok } from '@/core/result';
import type { Result } from '@/core/result';
import type { Layout } from '@/core/types';
import { getCommandSchema } from '../validation/schemas';
import type { CommandType } from '../commands';
import type { CommandDefShape } from '../v2/types';
import { addBin } from '../v2/domain/bin/addBin';
import { deleteBin } from '../v2/domain/bin/deleteBin';
import { moveBinFromStaging } from '../v2/domain/bin/moveBinFromStaging';
import { moveBinToStaging } from '../v2/domain/bin/moveBinToStaging';
import { updateBin } from '../v2/domain/bin/updateBin';
import { addCategory } from '../v2/domain/category/addCategory';
import { addLayer } from '../v2/domain/layer/addLayer';
import type { ChangeOp, ChangeSet, EntityRef } from './schema';

type EventOf<D extends { apply: (event: never, draft: never) => void }> = Parameters<D['apply']>[0];

/** The events that a change set's ops emit, in the shapes their own commands apply. */
export type ChangeSetEvent =
  | EventOf<typeof addBin>
  | EventOf<typeof updateBin>
  | EventOf<typeof deleteBin>
  | EventOf<typeof moveBinToStaging>
  | EventOf<typeof moveBinFromStaging>
  | EventOf<typeof addCategory>
  | EventOf<typeof addLayer>;

export interface ChangeSetFailure {
  readonly opIndex: number;
  readonly op: ChangeOp['op'];
  readonly reason: string;
}

export interface SimulatedChangeSet {
  readonly layout: Layout;
  readonly events: readonly ChangeSetEvent[];
  /** Each `ref` in the set and the id that it got. */
  readonly refs: Readonly<Record<string, string>>;
}

type RefKind = 'bin' | 'layer' | 'category';

function describeError(error: unknown): string {
  if (error !== null && typeof error === 'object') {
    const { message, reason } = error as { message?: unknown; reason?: unknown };
    if (typeof message === 'string' && typeof reason === 'string') return `${message}: ${reason}`;
    if (typeof message === 'string') return message;
  }
  return String(error);
}

/**
 * Runs one command as the bus would: the bus's schema check, then the
 * command's own `handle` on the current state, then its `apply`.
 */
function runStep<TPayload, TValue, TEventType extends string, TEventPayload>(
  def: CommandDefShape<CommandType, TPayload, TValue, TEventType, TEventPayload, unknown, 'layout'>,
  payload: TPayload,
  layout: Layout
): Result<
  { layout: Layout; value: TValue; event: { type: TEventType; payload: TEventPayload } },
  string
> {
  const schema = getCommandSchema(def.type);
  if (schema) {
    const parsed = z.safeParse(schema, payload);
    if (!parsed.success) return err(parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  const handled = def.handle(payload, { aggregate: layout });
  if (isErr(handled)) return err(describeError(handled.error));
  const event = { type: def.emitted, payload: handled.value.event.payload };
  const next = produce(layout, (draft) => {
    def.apply(event, draft);
  });
  return ok({ layout: next, value: handled.value.value, event });
}

/** Applies a change set's events in order, as one edit. */
export function applyChangeSetEvents(
  draft: Draft<Layout>,
  events: readonly ChangeSetEvent[]
): void {
  for (const event of events) {
    switch (event.type) {
      case 'bin.added':
        addBin.apply(event, draft);
        break;
      case 'bin.updated':
        updateBin.apply(event, draft);
        break;
      case 'bin.deleted':
        deleteBin.apply(event, draft);
        break;
      case 'bin.movedToStaging':
        moveBinToStaging.apply(event, draft);
        break;
      case 'bin.movedFromStaging':
        moveBinFromStaging.apply(event, draft);
        break;
      case 'category.added':
        addCategory.apply(event, draft);
        break;
      case 'layer.added':
        addLayer.apply(event, draft);
        break;
      default: {
        const _exhaustive: never = event;
        throw new Error(`change set: unknown event ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
}

/**
 * Runs every op of a change set on a copy of the layout, with the same
 * validation as a real edit. The result is all or nothing: the first op that
 * fails stops the run and names itself.
 */
export function simulateChangeSet(
  layout: Layout,
  changeSet: ChangeSet
): Result<SimulatedChangeSet, ChangeSetFailure> {
  let current = layout;
  const events: ChangeSetEvent[] = [];
  const refs = new Map<string, { kind: RefKind; id: string }>();

  for (const [opIndex, op] of changeSet.ops.entries()) {
    const fail = (reason: string): Result<never, ChangeSetFailure> =>
      err({ opIndex, op: op.op, reason });

    const resolve = (target: EntityRef, kind: RefKind): Result<string, string> => {
      if ('ref' in target) {
        const found = refs.get(target.ref);
        if (!found) return err(`"${target.ref}" names no ${kind} that an earlier op added.`);
        if (found.kind !== kind) return err(`"${target.ref}" is a ${found.kind}, not a ${kind}.`);
        return ok(found.id);
      }
      const exists =
        kind === 'bin'
          ? current.bins.some((b) => b.id === target.id)
          : kind === 'layer'
            ? target.id === STAGING_ID || current.layers.some((l) => l.id === target.id)
            : current.categories.some((c) => c.id === target.id);
      return exists ? ok(target.id) : err(`The layout has no ${kind} "${target.id}".`);
    };

    const remember = (ref: string | undefined, kind: RefKind, id: string): Result<void, string> => {
      if (ref === undefined) return ok(undefined);
      if (refs.has(ref)) return err(`The ref "${ref}" is used twice.`);
      refs.set(ref, { kind, id });
      return ok(undefined);
    };

    const toItems = (names: readonly string[] | undefined) =>
      names?.map((name, k) => ({ id: `item-${k + 1}`, name }));

    let step: Result<{ layout: Layout; value: unknown; event: ChangeSetEvent }, string>;
    let added: { ref: string | undefined; kind: RefKind } | null = null;

    switch (op.op) {
      case 'addBin': {
        const layer = resolve(op.layer, 'layer');
        if (isErr(layer)) return fail(layer.error);
        const category = op.category
          ? resolve(op.category, 'category')
          : ok(current.categories.at(0)?.id);
        if (isErr(category)) return fail(category.error);
        if (category.value === undefined) return fail('The layout has no category for the bin.');
        const items = toItems(op.items);
        step = runStep(
          addBin,
          {
            layerId: layer.value,
            x: op.x,
            y: op.y,
            width: op.width,
            depth: op.depth,
            height: op.height,
            category: category.value,
            label: op.label ?? '',
            notes: '',
            ...(items?.length ? { items } : {}),
          },
          current
        );
        added = { ref: op.ref, kind: 'bin' };
        break;
      }
      case 'updateBin': {
        const bin = resolve(op.bin, 'bin');
        if (isErr(bin)) return fail(bin.error);
        const { category: categoryRef, items: names, ...fields } = op.set;
        const category = categoryRef ? resolve(categoryRef, 'category') : ok(undefined);
        if (isErr(category)) return fail(category.error);
        step = runStep(
          updateBin,
          {
            id: bin.value,
            updates: {
              ...fields,
              ...(category.value !== undefined ? { category: category.value } : {}),
              ...(names !== undefined ? { items: toItems(names) } : {}),
            },
          },
          current
        );
        break;
      }
      case 'moveBin': {
        const bin = resolve(op.bin, 'bin');
        if (isErr(bin)) return fail(bin.error);
        const layer = resolve(op.layer, 'layer');
        if (isErr(layer)) return fail(layer.error);
        const stashed = current.bins.find((b) => b.id === bin.value)?.layerId === STAGING_ID;
        step =
          layer.value === STAGING_ID
            ? runStep(moveBinToStaging, { id: bin.value }, current)
            : stashed
              ? runStep(
                  moveBinFromStaging,
                  { id: bin.value, layerId: layer.value, x: op.x, y: op.y },
                  current
                )
              : runStep(
                  updateBin,
                  { id: bin.value, updates: { layerId: layer.value, x: op.x, y: op.y } },
                  current
                );
        break;
      }
      case 'stashBin': {
        const bin = resolve(op.bin, 'bin');
        if (isErr(bin)) return fail(bin.error);
        step = runStep(moveBinToStaging, { id: bin.value }, current);
        break;
      }
      case 'deleteBin': {
        const bin = resolve(op.bin, 'bin');
        if (isErr(bin)) return fail(bin.error);
        step = runStep(deleteBin, { id: bin.value }, current);
        break;
      }
      case 'addCategory': {
        const color =
          CATEGORY_COLOR_PALETTE[current.categories.length % CATEGORY_COLOR_PALETTE.length].color;
        step = runStep(addCategory, { name: op.name, color }, current);
        added = { ref: op.ref, kind: 'category' };
        break;
      }
      case 'addLayer': {
        step = runStep(addLayer, {}, current);
        added = { ref: op.ref, kind: 'layer' };
        break;
      }
      default: {
        const _exhaustive: never = op;
        return fail(`Unknown op ${JSON.stringify(_exhaustive)}`);
      }
    }

    if (isErr(step)) return fail(step.error);
    if (added) {
      const saved = remember(added.ref, added.kind, String(step.value.value));
      if (isErr(saved)) return fail(saved.error);
    }
    current = step.value.layout;
    events.push(step.value.event);
  }

  return ok({
    layout: current,
    events,
    refs: Object.fromEntries([...refs].map(([ref, { id }]) => [ref, id])),
  });
}
