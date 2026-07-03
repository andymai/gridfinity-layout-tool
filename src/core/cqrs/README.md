# CQRS + Event Sourcing Infrastructure

Command/Query Responsibility Segregation layer that wraps existing Zustand store mutations. Commands represent user intent, events represent past-tense facts that happened, and the event store persists them to IndexedDB for audit trail and replay.

## Architecture Overview

```
User Action
    |
    v
createCommand('bin.add', payload)
    |
    v
commandBus.dispatch(command)
    |
    v
[Middleware Pipeline]
    validation  ->  undoCapture  ->  analytics  ->  logging
    (Zod)           (domain only)    (PostHog)      (dev only)
    |
    v
Command Handler
    - Reads/mutates Zustand store
    - Returns Result<CommandSuccess, LayoutError | ValidationError>
    - Produces domain events
    |
    v
eventBus.publishAll(events)
    |
    v
[Event Subscribers]
    - Event Store (IndexedDB persistence, async)
    - Feature-specific subscribers
```

## Key Concepts

| Concept         | Description                                                                               |
| --------------- | ----------------------------------------------------------------------------------------- |
| **Command**     | Typed user intent (present tense: `bin.add`, `layer.delete`). Validated before execution. |
| **Event**       | Past-tense domain fact (`bin.added`, `layer.deleted`). Immutable once emitted.            |
| **Handler**     | Pure function: Command -> store mutation + events. Returns `Result`.                      |
| **Middleware**  | Intercepts commands pre/post-handler. Pipeline is configurable.                           |
| **Event Store** | Append-only IndexedDB database. Async fire-and-forget with retry queue.                   |
| **Correlation** | Every command gets a `correlationId` that propagates to all resulting events.             |

## Directory Structure

```
src/core/cqrs/
├── index.ts              # Public barrel — all exports
├── types.ts              # Core types: CommandId, EventId, Middleware, etc.
├── commandDescriptions.ts # CommandType -> i18n key for undo/redo toasts
├── bus/
│   ├── commandBus.ts     # Synchronous command dispatch with middleware
│   └── eventBus.ts       # Pub/sub for domain events
├── commands/             # Command type unions per domain + factory
│   #   bin, layer, category, drawer, designer, library, restore
├── events/               # Past-tense event type unions per domain
├── v2/
│   ├── defineCommand.ts  # v2 command factory: one literal with handle() + apply()
│   ├── registry.ts       # All migrated v2 commands -> v2HandlerOverrides
│   ├── runtime.ts        # wrapV2Handler: snapshot handle() + Immer-draft apply()
│   ├── createRegistry.ts # Typed registry builder
│   ├── Mutations.ts      # Mutations<typeof registry> type derivation
│   └── domain/           # One file per command: bin/, layer/, category/,
│       #                   drawer/, layout/, library/ (addBin.ts is canonical)
├── handlers/
│   ├── index.ts          # Registry: designerHandlers + restoreHandlers
│   │                     #   + v2HandlerOverrides (spread last, wins)
│   ├── shared.ts         # createEventMeta(), capturePrevious()
│   ├── designerHandlers.ts # Designer commands (still v1 by design)
│   └── restoreHandlers.ts  # layout.restore (undo/redo path)
├── middleware/
│   ├── index.ts          # Pipeline: validation -> undoCapture -> analytics -> logging
│   ├── middlewareConfig.ts # COMMAND_PROFILES: which middleware runs per command
│   ├── analytics.ts      # PostHog bridge
│   ├── logging.ts        # Dev-only console.debug
│   └── undoCapture.ts    # Snapshot-based undo + batch() transactions
├── undo/
│   └── historyStore.ts   # Undo/redo stacks (max 100) + selection snapshots
├── subscribers/          # Event subscribers: selectionPruning,
│   #                       libraryPersistence, fillAnalytics
├── validation/
│   ├── index.ts          # Re-exports
│   ├── schemas.ts        # COMMAND_SCHEMAS — the Zod schemas the validation
│   │                     #   middleware uses at runtime (also for v2 commands)
│   ├── designerSchemas.ts / librarySchemas.ts
│   └── validationMiddleware.ts # Fail-fast payload validation
├── versioning/
│   ├── eventVersions.ts  # Current schema version per event type
│   └── migrations.ts     # Migration registry + chain walker
├── store/
│   ├── eventStore.ts     # IndexedDB persistence + bus subscriber
│   └── retryQueue.ts     # Exponential backoff for failed persistence
├── projection/
│   └── replay.ts         # Event replay for state reconstruction
└── integration/
    └── mutationsAdapter.ts # Strangler fig: Mutations interface -> CQRS
```

## How to Add a New Command/Event Pair (v2)

New domain commands are v2 commands: a single `defineCommand()` literal whose
`handle()` plans against a read-only aggregate snapshot and whose `apply()`
deterministically mutates an Immer draft using only the event payload.
`v2/domain/bin/addBin.ts` is the canonical example. Designer and restore
commands intentionally remain v1 (`handlers/designerHandlers.ts`,
`handlers/restoreHandlers.ts`).

### Checklist

1. **Define the command type** in `commands/<domain>Commands.ts` and add it to
   the domain command union.

2. **Define the event type** in `events/<domain>Events.ts` and add it to the
   domain event union.

3. **Re-export** both from `commands/index.ts`, `events/index.ts`, and the
   CQRS barrel `index.ts`.

4. **Add current schema version** in `versioning/eventVersions.ts`:

   ```typescript
   'domain.myActionDone': 1,
   ```

5. **Write the command def** in `v2/domain/<aggregate>/<name>.ts`:

   ```typescript
   export const myAction = defineCommand({
     type: 'domain.myAction',
     aggregate: 'layout',
     aggregateId: () => 'layout',
     payload: payloadSchema,
     emitted: 'domain.myActionDone',
     schemaVersion: 1,
     descriptionKey: 'undo.action.myAction',
     middleware: { undoCapture: true, validate: true, analytics: true },
     handle: (payload, ctx) => {
       // read-only planning against ctx.aggregate; brand payload values at
       // this boundary; generate ids AFTER validation; put everything
       // apply() needs into the event payload
       return ok({ value: undefined, event: { payload: { ... } } });
     },
     apply: (event, draft) => {
       // deterministic mutation from event payload only
     },
   });
   ```

6. **Register it** in `v2/registry.ts` (import + add to the
   `v2HandlerOverrides` literal). `handlers/index.ts` spreads that registry
   automatically.

7. **Add the command's profile** to `COMMAND_PROFILES` in
   `middleware/middlewareConfig.ts` (the record is exhaustive over
   `CommandType`) and its toast key to `commandDescriptions.ts` — that map,
   not the def's `descriptionKey`, drives the undo/redo toast.

8. **Add a Zod validation schema** in `validation/schemas.ts` — the
   validation middleware reads `COMMAND_SCHEMAS`, not the def's `payload`
   schema:

   ```typescript
   'domain.myAction': z.object({ foo: z.string().min(1) }),
   ```

9. **Add a replay case** in `projection/replay.ts`:

   ```typescript
   case 'domain.myActionDone':
     // Apply event to layout state
     break;
   ```

10. **Expose it** through the `Mutations` interface if the UI calls it
    (`integration/mutationsAdapter.ts`, `src/shared/contexts/MutationsContext.tsx`).

11. **Write tests** colocated with the def (`<name>.test.ts`; see
    `_testHelpers.ts` in each domain directory) plus the schema.

## Schema Versioning and Migration

Events are persisted to IndexedDB and may outlive code changes. The versioning system ensures old events can be read by new code.

### How It Works

1. Every event type has a current schema version in `versioning/eventVersions.ts`.
2. When an event is emitted, `createEventMeta()` stamps it with the current `schemaVersion`.
3. When a persisted event is read, `migrateEvent()` checks its `schemaVersion` against the current version and runs any registered migrations.

### Bumping a Version

1. Increment the version in `eventVersions.ts`:

   ```typescript
   'bin.added': 2,  // was 1
   ```

2. Register a migration in `migrations.ts` or a new migration file:

   ```typescript
   registerMigration('bin.added', 1, 2, (event: unknown) => {
     const e = event as { payload: { bin: Record<string, unknown> } };
     return {
       ...e,
       payload: {
         ...e.payload,
         bin: { ...e.payload.bin, newField: 'default' },
       },
     };
   });
   ```

3. Migrations chain automatically: v1 -> v2 -> v3 if both steps are registered.

4. Events without a `schemaVersion` field are assumed to be v1 (pre-versioning).

### Migration Rules

- Migrations must be **pure functions** (no side effects).
- Always provide sensible defaults for new fields.
- Never remove fields in a migration — old code may still reference them.
- Test each migration step independently.

## Validation Schema Guide

Command payloads are validated by Zod schemas before reaching handlers. This provides fail-fast behavior with structured error messages.

### Adding a Schema

1. Open `validation/schemas.ts`.
2. Add an entry to `COMMAND_SCHEMAS`:
   ```typescript
   'domain.myAction': z.object({
     foo: z.string().min(1).max(64),
     bar: z.number().int().gte(0).optional(),
   }),
   ```
3. The validation middleware will automatically pick it up.
4. If no schema is registered for a command type, it passes through (forward-compatible).

### Conventions

- Use constants from `@/core/constants` for limits (GRID_MIN, GRID_MAX, etc.).
- String IDs: `z.string().min(1)` (never empty).
- Grid coordinates: `z.number().gte(0)` (non-negative).
- Sizes: `z.number().gt(0).lte(GRID_MAX)`.
- Labels: `z.string().max(MAX_LABEL_LENGTH)`.

## Undo Integration

The `undoCaptureMiddleware` takes a snapshot of the layout state **before** each domain command executes. On undo, the snapshot is restored directly (not replayed from events). Undo capture runs unconditionally for all domain commands (`bin.*`, `layer.*`, `category.*`, `drawer.*`, `layout.*`) and is skipped for library, designer, UI, and restore commands via the middleware flags registry.

## Event Persistence and Retry

### Normal Flow

1. `connectEventStoreToBus()` subscribes to all events on the event bus.
2. Each event is appended to IndexedDB asynchronously (fire-and-forget).
3. After append, aggregate event count is checked. If over 10,000, oldest events are evicted.

### Retry Queue

When an IndexedDB `append()` fails:

1. The event is enqueued in an in-memory retry queue.
2. Retries use exponential backoff: 1s, 2s, 4s.
3. After 3 failed attempts, the event is dropped and a structured warning is logged.
4. Retry processing is setTimeout-based and never blocks the command pipeline.

### Important: Persistence is Best-Effort

Event persistence is designed for observability and debugging, not as a source of truth. The Zustand stores remain the authoritative state. If all retry attempts fail, the application continues functioning normally — only the audit trail is affected.

## Integration: Strangler Fig Pattern

The `mutationsAdapter.ts` implements the existing `Mutations` interface by routing all calls through the command bus. This allows features to opt into CQRS without changing their calling code:

```typescript
// Before: direct store mutation
mutations.addBin({ layerId, x, y, width, depth, height, category, label, notes });

// After: same interface, routed through CQRS pipeline
const cqrsMutations = createCqrsMutations(commandBus);
cqrsMutations.addBin({ layerId, x, y, width, depth, height, category, label, notes });
// -> validates payload -> captures undo -> mutates store -> emits events -> persists
```

## Testing

```bash
# Run all CQRS tests
pnpm run test:run src/core/cqrs/

# Run specific test file
pnpm run test:run src/core/cqrs/store/retryQueue.test.ts
```

Do not write `pnpm run test:run -- <filter>` — pnpm forwards the literal `--`
and vitest then ignores the filter, silently running the entire suite.

Handler tests use `createTestLayout()` from `@/test/testUtils`. Test events can be constructed with the `makeEvent()` helper pattern used in `eventBus.test.ts`.
