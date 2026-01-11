---
active: true
iteration: 1
max_iterations: 15
completion_promise: "SHARE_COMPLETE"
started_at: "2026-01-11T02:37:07Z"
---

Add layout sharing/export functionality. Users should be able to: (1) Export a layout as a JSON file with metadata, (2) Generate a shareable URL with the layout encoded in the URL hash, (3) Import layouts from pasted JSON or URL. Integrate with both desktop LayoutManagerModal (export button) and MobileLayoutsPanel (share action). Check src/components/modals/ImportModal.tsx for existing import patterns. Run tests after each change. Output SHARE_COMPLETE in a promise tag when sharing works and tests pass.
