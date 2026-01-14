# Labs Feature Flags

A client-side feature flagging system that allows users to opt into experimental features before they're ready for general availability.

## Overview

The Labs system provides a "Google Search Labs"-style experience where users can:
- Browse available experimental features
- Understand risks before opting in
- Toggle features on/off with immediate effect
- Have preferences persist across sessions and sync across tabs

### Initial Features

1. **Collaborative Editing** - Real-time multi-user layout editing
2. **Drawer-to-Print** - STL generation and export system

## Documentation

| Document | Description |
|----------|-------------|
| [PRD](./prd.md) | Product requirements, user stories, acceptance criteria |
| [Architecture](./architecture.md) | Technical implementation, data models, component design |
| [Design Requirements](./design-requirements.md) | UI/UX specifications, visual design, accessibility |

## Quick Links

### Key Design Decisions

- **Entry Point**: Labs button in sidebar settings area
- **UI Pattern**: Side drawer sliding from right
- **Acknowledgment**: Simple toggle, no confirmation dialogs
- **Active Indicator**: Badge on Labs button showing enabled count
- **Feature Organization**: Flat list with graduated section
- **Feature Info**: Rich cards with name, description, status, risk, warnings
- **Activation**: Immediate effect, no page refresh required
- **Tab Sync**: Yes, via localStorage storage events
- **Config Location**: TypeScript code constants
- **Graduation**: Features marked as "graduated" always return enabled
- **Analytics**: Track via PostHog (drawer opens, feature toggles)

### Technical Stack

- **State**: Zustand store (`useLabsStore`)
- **Storage**: localStorage (`gridfinity-labs-v1`)
- **Sync**: Browser storage events (existing pattern)
- **Analytics**: PostHog (existing integration)
- **UI**: React components following existing patterns

## Status

**Current Phase**: Planning / Architecture Design

- [x] Requirements gathered
- [x] Architecture documented
- [x] Design requirements documented
- [ ] Implementation
- [ ] Testing
- [ ] Release

## Related Projects

- [Collaborative Editing](../collaborative-editing/) - First Labs feature
- [Drawer-to-Print](../../drawer-to-print/) - Second Labs feature
