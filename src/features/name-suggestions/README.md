# Name Suggestions Feature

Intelligent layout name suggestions based on bin contents, categories, and drawer dimensions.

## Overview

When users have 5+ labeled bins and their layout is still named "Untitled layout", this feature suggests meaningful names like "Electronics Drawer" or "Workshop Organizer".

## Key Files

- `types.ts` - Type definitions
- `utils/generateSuggestions.ts` - Core suggestion algorithm
- `store/index.ts` - Zustand store for suggestion state
- `hooks/` - React hooks for consumption
- `components/` - UI components

## Usage

```tsx
import { NameFieldHighlight } from '@/features/name-suggestions';

// Wrap the layout name input in Header
<NameFieldHighlight>
  <button>{layoutName}</button>
</NameFieldHighlight>;
```

## Suggestion Sources

1. **Labels** - Analyzes bin labels using `labelVocabulary.ts` domains
2. **Purpose** - Uses `purposeInference.ts` to detect drawer purpose
3. **Categories** - Uses custom category names if significant
4. **Dimensions** - Fallback using drawer size

## Trigger Conditions

- 5+ bins have labels
- Layout name is "Untitled layout"
- Not dismissed in current session

## Entry Points

1. **Auto-trigger** - Pulsing highlight on name field in Header
2. **Command Palette** - "Suggest Layout Name" command
3. **Layout Manager** - "Suggest Name" menu item

## Telemetry

Tracks (privacy-preserving):

- `shown` - Suggestions displayed
- `accepted` - User accepted a suggestion
- `edited` - User modified a suggestion
- `dismissed` - User dismissed suggestions

All names are hashed before sending to analytics.
