# Snapshots (Version History)

Automatic periodic snapshots of layout state, stored in IndexedDB. Provides a user-facing History panel for browsing and restoring past versions.

## Architecture

- **SnapshotService** (`core/storage/SnapshotService.ts`) — CRUD + rolling window logic
- **Snapshot store** (`core/store/snapshots.ts`) — Zustand state for the active layout's snapshots
- **useSnapshotAutoSave** (`hooks/useSnapshotAutoSave.ts`) — 2-minute interval auto-save hook
- **UI components** (`features/snapshots/components/`) — History panel, entry rows, restore dialog

## Key behaviors

- Max 10 unlabeled (auto) snapshots per layout; labeled snapshots are exempt from eviction
- Snapshots store compressed layout data in IndexedDB (reuses `compressLayout`/`decompressLayout`)
- Snapshots are cleaned up when a layout is deleted
- History tab appears in the RightPanel alongside the Inspector tab
