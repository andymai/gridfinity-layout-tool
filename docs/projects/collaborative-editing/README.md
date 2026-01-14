# Collaborative Layout Editing

Real-time multi-user editing for Gridfinity layouts, similar to Figma or Miro.

## Overview

This feature enables multiple users to simultaneously view and edit the same layout with live cursor presence, real-time sync, and a trust-based permission model.

### Key Capabilities

- **Real-time collaboration**: See others' cursors and edits instantly
- **Permission modes**: Read-only (view) or editable sessions
- **Trust-based sharing**: Anyone with the link can join
- **24-hour sessions**: Auto-expire to prevent orphaned sessions
- **Local preferences**: Zoom, 3D preview, and selection remain per-user

## Documents

| Document | Description |
|----------|-------------|
| [PRD](./prd.md) | Product requirements, user stories, acceptance criteria |
| [Architecture](./architecture.md) | Technical design, data models, sync strategy |
| [Design Requirements](./design-requirements.md) | UI/UX specifications, components, accessibility |

## Quick Links

### User Flow

```
Owner                                    Participant
  │                                           │
  ├─► Create session (/collab/{id})           │
  │   └─► Choose: edit or view-only           │
  │                                           │
  ├─► Share link ─────────────────────────────┤
  │                                           │
  │                           Click link ◄────┤
  │                           Join session ◄──┤
  │                                           │
  ├─► See participant cursor                  │
  │                       See owner cursor ◄──┤
  │                                           │
  ├─► Edit bins together ◄────────────────────┤
  │                                           │
  ├─► End session                             │
  │       └─► Save copy prompt ───────────────┤
  ▼                                           ▼
```

### URL Structure

| Pattern | Description |
|---------|-------------|
| `/collab/{sessionId}` | Join a collaborative session |
| `/collab/{sessionId}?name=Alex` | Join with custom display name |
| `/s/{shareId}` | Existing read-only cloud share (unchanged) |

### What Syncs vs What Doesn't

| Synced (shared) | Local (per-user) |
|-----------------|------------------|
| Layout data (bins, layers, categories) | Zoom level |
| Layout name | Active layer selection |
| Drawer dimensions | Selected bins |
| Print settings | 3D preview state |
| | Panel collapsed state |

## Status

**Current Phase**: Design & Planning

- [x] Systems architecture
- [x] Product requirements (PRD)
- [x] Design requirements
- [ ] API design
- [ ] Implementation
- [ ] Testing
- [ ] Launch

## Related

- [Cloud Sharing Plan](../../cloud-sharing-plan.md) - Existing sharing infrastructure
- [Analytics Architecture](../../analytics-architecture.md) - Event tracking patterns
