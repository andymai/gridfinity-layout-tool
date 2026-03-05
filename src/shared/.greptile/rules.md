# Shared Code Review Guidelines

## Dependency Direction

The dependency arrow is strictly one-way:

```
features/ → shared/ → core/
```

Shared code may import from `core/` (types, constants, stores) but **never** from `features/`. If you need feature-specific behavior in shared code, use dependency inversion:

**Known exception:** Shared barrels (`src/shared/constants/bin.ts`, `src/shared/types/bin.ts`) re-export canonical definitions from `src/features/bin-designer` to prevent circular cross-feature imports. This is an intentional architectural pattern, not a violation.

- Callbacks or render props for behavior injection
- Generics for type flexibility
- React context for runtime configuration

## What Belongs in Shared

- **components/**: UI primitives reused by 2+ features (Button, Dialog, Input, Select)
- **hooks/**: Cross-cutting hooks (auto-save, responsive breakpoints, PWA, focus trap)
- **utils/**: Pure functions (collision detection, validation, compression, color math)
- **contexts/**: React contexts for app-wide concerns (mutations, collaboration)
- **types/**: Re-exported types that prevent circular dependencies between features
- **constants/**: Shared configuration values

## What Does NOT Belong in Shared

- Feature-specific components (even if "similar" to another feature's component)
- Business logic tied to a single feature's domain
- One-off utilities used by only one feature (keep these in the feature)

## Hook Contract Documentation

Shared hooks are consumed across the app, so their contracts must be clear:

- Parameter types and defaults
- Return value shape
- Side effects (store mutations, localStorage, network calls)
- Cleanup behavior
- Dependencies that callers should be aware of (e.g., "requires LayoutProvider context")
