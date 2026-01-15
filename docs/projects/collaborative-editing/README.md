# Collaborative Layout Editing

Real-time multi-user editing for Gridfinity layouts, following the Google Docs sharing model.

## Overview

This feature extends the existing cloud sharing with **permission levels**, enabling multiple users to simultaneously view and edit the same layout with live cursor presence and real-time sync.

### Key Capabilities

- **Permission-based sharing**: Share as view-only (default) or enable editing
- **Real-time collaboration**: See others' cursors and edits instantly
- **Single URL**: Same `/s/{id}` URL for both modes—permission stored server-side
- **Persistent**: No session expiration—collaboration lasts until owner stops sharing
- **Local preferences**: Zoom, 3D preview, and selection remain per-user

## Documents

| Document | Description |
|----------|-------------|
| [PRD](./prd.md) | Product requirements, user stories, acceptance criteria |
| [Architecture](./architecture.md) | Technical design, Liveblocks integration, data models |
| [Design Requirements](./design-requirements.md) | UI/UX specifications, components, accessibility |

## Quick Links

### Sharing Model (Google Docs-style)

```
┌─────────────────────────────────────────────────────┐
│   Share this layout                                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│   Anyone with the link can:                         │
│                                                     │
│   [View ▼]  ← dropdown: View | Edit                 │
│                                                     │
│   https://gridfinity.app/s/abc123xyz789             │
│                                                     │
│   [Copy link]                                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

URL stays the same regardless of permission—just like Google Docs.

### URL Structure

| Pattern | Description |
|---------|-------------|
| `/s/{shareId}` | Cloud share (permission determines view or edit mode) |
| `/s/{shareId}?name=Alex` | Join with custom display name |

Permission is stored server-side, not in the URL.

### What Syncs vs What Doesn't

| Synced (shared) | Local (per-user) |
|-----------------|------------------|
| Layout data (bins, layers, categories) | Zoom level |
| Layout name | Active layer selection |
| Drawer dimensions | Selected bins |
| Print settings | 3D preview state |
| | Panel collapsed state |

### Technology

- **Real-time sync**: [Liveblocks](https://liveblocks.io/) - managed collaboration platform
- **Feature flag**: Labs toggle (`collaborativeEditing`)
- **Storage**: Liveblocks Storage (primary) + Vercel Blob (backup)

## Status

**Current Phase**: Design & Planning (v2.0 revision complete)

- [x] Systems architecture (v2.0)
- [x] Product requirements - PRD (v2.0)
- [x] Design requirements (v2.0)
- [ ] Feature flag implementation
- [ ] API design
- [ ] Implementation
- [ ] Testing
- [ ] Launch

### Revision Summary (v2.0)

Major changes from v1.0:

| v1.0 (Session-based) | v2.0 (Permission-based) |
|---------------------|------------------------|
| Temporary sessions (24h expiry) | Persistent (no expiration) |
| Separate `/collab/` URL | Single `/s/` URL, permission server-side |
| PartyKit for real-time | Liveblocks for real-time |
| Session start/end workflow | Permission toggle in share panel |
| Separate "Collaborate" tab | Unified share panel |

## Related

- [Cloud Sharing Plan](../../cloud-sharing-plan.md) - Existing sharing infrastructure
- [Labs Feature Flags](../../systems-architecture/labs-feature-flags.md) - Feature flag system
