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
├── bus/
│   ├── commandBus.ts     # Synchronous command dispatch with middleware
│   └── eventBus.ts       # Pub/sub for domain events
├── commands/
│   ├── index.ts          # Command union, factory, re-exports
│   ├── binCommands.ts    # Bin command types (9 commands)
│   ├── layerCommands.ts  # Layer command types (4 commands)
│   ├── categoryCommands.ts # Category command types (3 commands)
│   └── drawerCommands.ts # Drawer/layout command types (6 commands)
├── events/
│   ├── index.ts          # DomainEvent union, re-exports
│   ├── binEvents.ts      # Bin event types
│   ├── layerEvents.ts    # Layer event types
│   ├── categoryEvents.ts # Category event types
│   └── drawerEvents.ts   # Drawer/layout event types
├── handlers/
│   ├── index.ts          # Handler registry (maps command type -> handler fn)
│   ├── shared.ts         # createEventMeta(), capturePrevious()
│   ├── binHandlers.ts    # Bin command handlers
│   ├── layerHandlers.ts  # Layer command handlers
│   ├── categoryHandlers.ts # Category command handlers
│   └── drawerHandlers.ts # Drawer command handlers
├── middleware/
│   ├── index.ts          # Pipeline construction (getDefaultPipeline)
│   ├── analytics.ts      # PostHog bridge
│   ├── logging.ts        # Dev-only console.debug
│   └── undoCapture.ts    # Snapshot-based undo (behind Labs flag)
├── validation/
│   ├── index.ts          # Re-exports
│   ├── schemas.ts        # Zod schemas for all 22 commands
│   └── validationMiddleware.ts # Fail-fast payload validation
├── versioning/
│   ├── index.ts          # Re-exports
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

## How to Add a New Command/Event Pair

### Checklist

1. **Define the command type** in `commands/<domain>Commands.ts`:

   ```typescript
   export type MyNewCommand = BaseCommand<'domain.myAction', { readonly foo: string }>;
   ```

2. **Add to the domain command union** in the same file.

3. **Define the event type** in `events/<domain>Events.ts`:

   ```typescript
   export type MyActionDoneEvent = BaseDomainEvent<'domain.myActionDone', { readonly foo: string }>;
   ```

4. **Add to the domain event union** in the same file.

5. **Re-export** both types from `commands/index.ts` and `events/index.ts`.

6. **Re-export** from the CQRS barrel `index.ts`.

7. **Add current schema version** in `versioning/eventVersions.ts`:

   ```typescript
   'domain.myActionDone': 1,
   ```

8. **Write the handler** in `handlers/<domain>Handlers.ts`:

   ```typescript
   function handleMyAction(command: MyNewCommand): CommandResult<void, DomainEvent> {
     // 1. Read current state from Zustand store
     // 2. Validate business rules
     // 3. Mutate store
     // 4. Create event with createEventMeta()
     // 5. Return ok({ value: undefined, events: [event] })
   }
   ```

9. **Register the handler** in `handlers/index.ts`.

10. **Add a Zod validation schema** in `validation/schemas.ts`:

    ```typescript
    'domain.myAction': z.object({ foo: z.string().min(1) }),
    ```

11. **Add a replay case** in `projection/replay.ts`:

    ```typescript
    case 'domain.myActionDone':
      // Apply event to layout state
      break;
    ```

12. **Write tests** for the handler and schema.

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
npm run test:run -- src/core/cqrs/

# Run specific test file
npm run test:run -- src/core/cqrs/store/retryQueue.test.ts
```

Handler tests use `createTestLayout()` from `@/test/testUtils`. Test events can be constructed with the `makeEvent()` helper pattern used in `eventBus.test.ts`.
