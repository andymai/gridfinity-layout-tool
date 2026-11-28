# Ask AI in the app

The Ask AI panel inside the layout editor. It runs the same session as the docs panel (`src/agent/client/session.ts`) against `/api/docs-ask` with `door: 'app'`, which the server keeps behind `APP_ASSISTANT_ENABLED` (see `api/README.md`).

## Key files

- `utils/askAiChat.ts`: the one session for the page. The session writes into a plain state; each change publishes a new snapshot for `useSyncExternalStore`, because React Compiler skips a child whose props keep their identity.
- `utils/browserCalls.ts`: runs the browser calls. Reads go through `src/agent/reader/readers.ts` on the app's own stores. `propose_changes` runs `prepareChanges` on the open layout; a set that the app refuses goes back at once, and Apply runs the set again before `layout.applyChangeSet`, so one Undo reverts it.
- `utils/changePreview.ts`: the change card's op list and drawer map, from the layout as it is now.
- `store/askAiStore.ts`: whether the server's app door is on, and whether the panel is open.

## Gotchas

- `src/shell/AskAi/AskAiMount` mounts the panel in each shell tree and maps `[[ui:…]]` labels to existing help targets (`labelTargets.ts`). A label without a target, or one whose text two targets share, stays plain. A phone has no sidebar, so its labels stay plain.
- The answer HTML comes from `render.ts`, which escapes the model's HTML. Keep every new element in it a real button or link: one click listener on the container handles them.
