# Design Linking Feature

Bidirectional integration between the Bin Designer and Layout Planner, enabling bins in layouts to be linked to saved designs.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Layout Planner                              │
│  ┌─────────────┐   ┌──────────────────┐   ┌──────────────────────┐  │
│  │   Grid      │   │   Inspector      │   │   Custom Bins        │  │
│  │  (bins)     │   │  (link status)   │   │   Palette            │  │
│  └──────┬──────┘   └────────┬─────────┘   └──────────┬───────────┘  │
└─────────┼──────────────────┼────────────────────────┼───────────────┘
          │                  │                        │
          ▼                  ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      design-linking feature                          │
│  ┌────────────┐   ┌────────────────┐   ┌────────────────────────┐  │
│  │  domain/   │   │    hooks/      │   │     components/        │  │
│  │            │   │                │   │                        │  │
│  │ linkingRu- │   │ useBinLinking  │   │ LinkedDesignSection    │  │
│  │ les.ts     │   │ useLinkedDe-   │   │ CreateDesignDialog     │  │
│  │ syncOps.ts │   │   sign         │   │ SyncDimensionsDialog   │  │
│  │ queries.ts │   │ useLinkedBins  │   │ LinkDesignDialog       │  │
│  └────────────┘   └────────────────┘   └────────────────────────┘  │
│                            │                                        │
│                            ▼                                        │
│              ┌──────────────────────────┐                           │
│              │    store/linkingStore    │                           │
│              │  (transient UI state)    │                           │
│              └──────────────────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
          │                  │                        │
          ▼                  ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Bin Designer                                 │
│  ┌─────────────────────┐   ┌──────────────────────────────────────┐ │
│  │ CustomBinRegistry   │   │         DesignerStorage              │ │
│  │   (localStorage)    │   │          (IndexedDB)                 │ │
│  │ lightweight refs    │   │      full SavedDesign                │ │
│  └─────────────────────┘   └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Model

### Bin Extension

```typescript
interface Bin {
  // ... existing fields ...
  linkedDesignId?: string; // reference to SavedDesign.id
}
```

### Linking Relationship

- **One-to-many**: Multiple bins can link to one design
- **Sync scope**: Only dimensions (width, depth, height)
- **Ownership**: Layout owns the bin, Designer owns the design

## Key Flows

### 1. Edit Linked Design

```
User selects bin → Clicks "Edit Design" →
Designer opens with design → User edits →
Auto-save updates design → User returns to planner
```

### 2. Create Design from Bin

```
User selects unlinked bin → Clicks "Create Design" →
Dialog prompts for name → Designer opens with dimensions →
User customizes → Save creates design + links bin
```

### 3. Link Existing Design

```
User selects unlinked bin → Clicks "Link Existing" →
Dialog shows compatible designs (matching footprint) →
User selects design → Bin linked to design
```

### 4. Sync Dimensions

```
Design dimensions changed → User clicks "Sync" →
Check eligibility for each linked bin →
Bins that fit: update dimensions →
Bins that don't fit: unlink (with notification)
```

## Domain Layer

Pure functions for business logic, fully testable:

- `linkingRules.ts` - Validation, eligibility checks
- `syncOperations.ts` - Dimension extraction, update creation
- `linkageQueries.ts` - Query bins/designs by link status

## Testing

```bash
npm run test -- src/features/design-linking
```

## Usage Example

```tsx
import { useBinLinking, useLinkedDesign } from '@/features/design-linking';

function BinActions({ bin }) {
  const { linkedDesign, isStale, hasLink } = useLinkedDesign(bin.linkedDesignId);
  const { editLinkedDesign, showCreateDesignDialog, unlinkBin } = useBinLinking();

  if (hasLink && linkedDesign) {
    return (
      <>
        <button onClick={() => editLinkedDesign(linkedDesign.id)}>
          Edit Design
        </button>
        <button onClick={() => unlinkBin(bin.id)}>Unlink</button>
      </>
    );
  }

  return (
    <button onClick={() => showCreateDesignDialog(bin.id)}>
      Create Design
    </button>
  );
}
```
