# Snapshots (Version History)

Automatic periodic snapshots of layout state, stored in IndexedDB. Provides a user-facing History panel for browsing and restoring past versions.

## Architecture

### Feature (this directory)

- `components/SnapshotHistory/` — History panel with snapshot list
- `components/SnapshotEntry/` — individual snapshot row with restore/label actions
- `components/RestoreDialog/` — confirmation dialog for snapshot restoration
- `hooks/useRelativeTime.ts` — relative timestamp formatting ("2 min ago")

### Core (infrastructure)

- `core/storage/SnapshotService.ts` — CRUD + rolling window logic
- `core/store/snapshots.ts` — Zustand state for the active layout's snapshots
- `hooks/useSnapshotAutoSave.ts` — 2-minute interval auto-save hook

## Key behaviors

- Max 10 unlabeled (auto) snapshots per layout; labeled snapshots are exempt from eviction
- Snapshots store compressed layout data in IndexedDB (reuses `compressLayout`/`decompressLayout`)
- Snapshots are cleaned up when a layout is deleted
- History tab appears in the RightPanel alongside the Inspector tab
