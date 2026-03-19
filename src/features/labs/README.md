# Labs

Experimental feature flags for opt-in preview features.

```mermaid
graph TB
    LBtn[LabsButton] --> LD[LabsDrawer]
    LD --> FC[FeatureCard] & GS[GraduatedSection]
    FC -->|toggle| LS[(labs store)] --> LOCAL[(localStorage)]
    LS --> UFF[useFeatureFlag]
    UFF --> Features[Features using flags]
```

## Infrastructure Location

- **Definitions**: `@/core/labs/features.ts`
- **Store**: `@/core/store/labs`
- **Hook**: `@/hooks/useFeatureFlag`

## Components

- **LabsButton** - Opens labs drawer
- **LabsDrawer** - Main drawer UI with feature list
- **FeatureCard** - Individual feature toggle card
- **FeatureStatusBadge** - Status indicator (early access/beta/shipped)
- **GraduatedSection** - Collapsible "Now for everyone" section for shipped features

## Current Flags

| Flag                    | Status       | Purpose                        |
| ----------------------- | ------------ | ------------------------------ |
| `bin_designer`          | Graduated    | Custom bin designer            |
| `baseplate_generator`   | Graduated    | Custom baseplate generator     |
| `collaborative_editing` | Experimental | Real-time Liveblocks collab    |
| `brepkit_kernel`        | Experimental | Alternative 3D geometry engine |
| `cqrs_undo`             | Experimental | Improved undo/redo system      |

## Usage

```typescript
const isEnabled = useFeatureFlag('collaborative_editing');
```

## Gotchas

1. **Flags persisted in localStorage** - survives refresh
2. **Some flags require page reload** - noted in UI
3. **Feature definitions in core/labs** - not in this feature module
