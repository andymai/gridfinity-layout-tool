# Collaborative Editing - Implementation Plan

## Chosen Approach: Pragmatic + Clean Adapters

This plan combines phased delivery with clean adapter patterns for a balance of speed, quality, and risk mitigation.

---

## Implementation Phases

### Phase 1: Foundation (Files 1-5)
**Goal**: Liveblocks setup, cursor presence working

1. Install dependencies: `@liveblocks/client`, `@liveblocks/react`
2. Create `/src/liveblocks.config.ts` - Liveblocks client + room context
3. Create `/api/liveblocks-auth.ts` - Auth endpoint (trust-based for MVP)
4. Create `/src/components/Collab/CollabProvider.tsx` - RoomProvider wrapper
5. Create `/src/hooks/useCollabMode.ts` - Mode detection hook
6. Create `/src/components/Collab/CollabCursors.tsx` - Remote cursor rendering
7. Modify `/src/components/Grid/index.tsx` - Add CollabCursors overlay
8. Modify `/src/labs/features.ts` - Set `comingSoon: false`

**Milestone**: Two browser windows show each other's cursors

---

### Phase 2: Real-Time Sync (Files 6-8)
**Goal**: Layout changes sync between participants

9. Create `/src/hooks/useCollabSync.ts` - Bidirectional sync hook
10. Create `/src/hooks/useCollabLayout.ts` - Adapter: returns Liveblocks or Zustand
11. Create `/src/hooks/useCollabMutations.ts` - Mutation adapter
12. Modify `/src/App.tsx` - Wrap with CollabProvider conditionally
13. Extend `/src/types.ts` - Add `permission` field to CloudShareInfo

**Milestone**: Edit in window A, see update in window B

---

### Phase 3: Permission System (Files 9-11)
**Goal**: View-only vs edit permissions enforced

14. Modify `/api/share/[id].ts` - Add permission field to PUT/GET
15. Modify `/api/liveblocks-auth.ts` - Check permission, grant READ or FULL access
16. Create `/src/hooks/useCanEdit.ts` - Permission check hook
17. Modify `/src/hooks/useCloudShare.ts` - Add updatePermission method
18. Modify share panel UI - Add permission selector dropdown

**Milestone**: View-only users cannot edit

---

### Phase 4: UI Polish (Files 12-15)
**Goal**: Production-ready UI

19. Create `/src/components/collab/CollabPresenceBar.tsx` - Participant avatars
20. Create `/src/components/collab/CollabBanner.tsx` - Status banner
21. Create `/src/hooks/useCollabStatus.ts` - Connection status hook
22. Create `/src/components/collab/CollabInteractionPreview.tsx` - Remote drag/resize
23. Add mobile cursor simplification

**Milestone**: Full collaborative UI with presence

---

### Phase 5: Testing & Launch (Files 16+)
**Goal**: Ship to users

24. Write unit tests for adapters and hooks
25. Write E2E tests for collaboration flow
26. Beta testing with Labs users
27. Fix bugs, performance tuning
28. Remove feature flag, ship

---

## File Summary

### New Files (15)
| # | File | Purpose | Est. Lines |
|---|------|---------|------------|
| 1 | `src/liveblocks.config.ts` | Liveblocks client setup | 80 |
| 2 | `api/liveblocks-auth.ts` | Auth endpoint | 100 |
| 3 | `src/components/Collab/CollabProvider.tsx` | Provider wrapper | 80 |
| 4 | `src/hooks/useCollabMode.ts` | Mode detection | 50 |
| 5 | `src/components/Collab/CollabCursors.tsx` | Cursor container | 60 |
| 6 | `src/components/Collab/CollabCursor.tsx` | Single cursor | 80 |
| 7 | `src/hooks/useCollabSync.ts` | Sync logic | 100 |
| 8 | `src/hooks/useCollabLayout.ts` | Layout adapter | 60 |
| 9 | `src/hooks/useCollabMutations.ts` | Mutation adapter | 200 |
| 10 | `src/hooks/useCanEdit.ts` | Permission check | 30 |
| 11 | `src/components/Collab/CollabPresenceBar.tsx` | Avatars | 100 |
| 12 | `src/components/Collab/CollabBanner.tsx` | Status banner | 80 |
| 13 | `src/hooks/useCollabStatus.ts` | Connection status | 60 |
| 14 | `src/components/Collab/CollabInteractionPreview.tsx` | Remote previews | 120 |
| 15 | `src/components/Collab/index.ts` | Public exports | 20 |

**Total new code**: ~1,220 lines

### Modified Files (8)
| # | File | Changes | Est. Lines |
|---|------|---------|------------|
| 1 | `src/types.ts` | Add `permission` to CloudShareInfo | +5 |
| 2 | `src/App.tsx` | Wrap with CollabProvider | +15 |
| 3 | `src/components/Grid/index.tsx` | Add CollabCursors | +10 |
| 4 | `src/labs/features.ts` | `comingSoon: false` | +1 |
| 5 | `api/share/[id].ts` | Permission field | +30 |
| 6 | `src/hooks/useCloudShare.ts` | updatePermission | +40 |
| 7 | `src/components/CloudShareTab.tsx` | Permission selector | +50 |
| 8 | `src/store/history.ts` | Collab-aware undo | +30 |

**Total modifications**: ~180 lines

---

## Technical Decisions

### 1. Sync Strategy: Snapshot-Based
- Send entire layout on change (simpler)
- Use `lastEditSource` to prevent sync loops
- Good enough for 2-5 concurrent editors

### 2. Auth: Trust-Based
- Anyone with edit link can edit
- Owner identified by localStorage fingerprint
- Add password protection in v2 if needed

### 3. Undo/Redo: Snapshot-Based
- Any user's undo reverts entire layout state
- Matches Figma/Google Docs behavior
- Simpler than per-user undo

### 4. Offline: Liveblocks Handles It
- Operations queued during disconnect
- Auto-sync on reconnect
- No custom implementation needed

---

## Environment Variables Needed

```bash
# Add to Vercel environment
LIVEBLOCKS_SECRET_KEY=sk_...
```

---

## Testing Strategy

### Unit Tests
- `useCollabMode.test.ts` - Mode detection logic
- `useCollabSync.test.ts` - Sync behavior
- `useCanEdit.test.ts` - Permission logic

### E2E Tests
- `collab-cursors.spec.ts` - Two users see cursors
- `collab-sync.spec.ts` - Edits sync between users
- `collab-permissions.spec.ts` - View-only enforcement

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Sync loops | `lastEditSource` tracking |
| Liveblocks cost | Monitor usage, cap rooms |
| Poor mobile perf | Defer mobile optimization |
| User abuse | Owner can disable anytime |

---

## Success Criteria

- [ ] Two users can see each other's cursors
- [ ] Layout changes sync in <500ms
- [ ] View-only users cannot edit
- [ ] Connection status visible
- [ ] Zero data loss in normal operation
