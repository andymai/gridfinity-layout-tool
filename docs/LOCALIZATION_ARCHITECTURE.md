# Localization System Architecture

This document describes the internationalization (i18n) architecture for the Gridfinity Layout Tool.

## Overview

The localization system is built on `react-i18next` with a namespace-based organization for maintainability and code-splitting support.

## Library Choice: react-i18next

**Why react-i18next:**
- Most mature React i18n library with excellent TypeScript support
- Namespace support for code-splitting (lazy-load translations)
- ICU message format for complex pluralization and interpolation
- React 19 compatible
- ~2KB gzipped (core), additional ~8KB for i18next
- Browser language detection built-in

## Directory Structure

```
src/
├── i18n/
│   ├── index.ts              # i18n configuration and initialization
│   ├── types.ts              # TypeScript types for translations
│   └── locales/
│       ├── en/
│       │   ├── common.json   # Shared UI strings (buttons, labels)
│       │   ├── layout.json   # Layout/drawer/bin related strings
│       │   ├── validation.json # Validation and error messages
│       │   ├── toast.json    # Toast notifications
│       │   ├── share.json    # Cloud share feature
│       │   ├── print.json    # Print list and split features
│       │   ├── help.json     # Keyboard shortcuts, help modal
│       │   ├── aria.json     # ARIA labels for accessibility
│       │   └── index.ts      # Barrel export
│       └── [locale]/         # Future: es/, fr/, de/, etc.
│           └── ...
├── hooks/
│   └── useTranslation.ts     # Custom hook wrapping react-i18next
```

## Namespace Organization

### `common` - Shared UI Strings (~50 keys)
```json
{
  "buttons": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "confirm": "Confirm",
    "close": "Close",
    "edit": "Edit",
    "duplicate": "Duplicate",
    "add": "Add",
    "remove": "Remove"
  },
  "labels": {
    "name": "Name",
    "width": "Width",
    "depth": "Depth",
    "height": "Height",
    "layer": "Layer",
    "category": "Category",
    "color": "Color"
  },
  "placeholders": {
    "search": "Search...",
    "enterName": "Enter name"
  },
  "units": {
    "gridUnits": "{{count}} unit",
    "gridUnits_other": "{{count}} units",
    "mm": "{{value}}mm"
  }
}
```

### `layout` - Layout Management (~40 keys)
```json
{
  "drawer": {
    "settings": "Drawer Settings",
    "width": "Drawer Width",
    "depth": "Drawer Depth",
    "height": "Drawer Height"
  },
  "layer": {
    "title": "Layers",
    "add": "Add Layer",
    "delete": "Delete Layer",
    "moveUp": "Move Layer Up",
    "moveDown": "Move Layer Down",
    "defaultName": "Layer {{number}}"
  },
  "category": {
    "title": "Categories",
    "add": "Add Category",
    "delete": "Delete Category",
    "defaultName": "Category {{number}}"
  },
  "bin": {
    "title": "Bin",
    "label": "Label",
    "notes": "Notes",
    "clearanceHeight": "Clearance Height",
    "position": "Position",
    "size": "Size"
  },
  "library": {
    "title": "My Layouts",
    "newLayout": "New Layout",
    "untitled": "Untitled layout",
    "lastModified": "Last modified {{date}}",
    "switchTo": "Switch to {{name}}"
  }
}
```

### `validation` - Error Messages (~25 keys)
```json
{
  "bin": {
    "outOfBounds": "Bin is outside drawer boundaries",
    "exceedsWidth": "Bin exceeds drawer width",
    "exceedsDepth": "Bin exceeds drawer depth",
    "exceedsHeight": "Bin exceeds available height",
    "collision": "Bin collides with another bin",
    "blockedZone": "Area is blocked by bins from higher layers",
    "invalidLayer": "Invalid layer selected"
  },
  "import": {
    "invalidFormat": "Invalid data format",
    "missingVersion": "Missing version information",
    "missingName": "Missing layout name",
    "invalidLayers": "Invalid layer configuration",
    "invalidBins": "Invalid bin data",
    "invalidCategories": "Invalid category data",
    "invalidDrawer": "Invalid drawer: must have width, depth, and height as numbers",
    "drawerWidthRange": "Drawer width must be between {{min}} and {{max}}",
    "layerCountRange": "Must have between {{min}} and {{max}} layers",
    "layerInvalid": "Layer {{index}} is invalid: {{reason}}",
    "binOutOfBounds": "Bin {{index}} is out of bounds",
    "layerHeightExceeds": "Total layer height exceeds drawer height",
    "duplicateCategoryName": "Duplicate category name: {{name}}"
  },
  "layout": {
    "notFound": "Layout not found",
    "loadFailed": "Failed to load layout data",
    "corrupted": "Layout data is corrupted"
  }
}
```

### `toast` - Toast Notifications (~35 keys)
```json
{
  "layout": {
    "created": "New layout created",
    "deleted": "Layout deleted",
    "saved": "Saved \"{{name}}\" to your layouts",
    "loadFailed": "Failed to load: {{message}}",
    "switched": "Switched to \"{{name}}\""
  },
  "bin": {
    "deleted": "Deleted {{count}} bin",
    "deleted_other": "Deleted {{count}} bins",
    "duplicated": "Duplicated {{count}} bin",
    "duplicated_other": "Duplicated {{count}} bins",
    "movedToStaging": "Moved to stash"
  },
  "category": {
    "inUse": "{{count}} bin uses \"{{name}}\". Reassign first.",
    "inUse_other": "{{count}} bins use \"{{name}}\". Reassign first.",
    "cannotDeleteLast": "Cannot delete the last category"
  },
  "layer": {
    "cannotDeleteLast": "Cannot delete the last layer"
  },
  "share": {
    "linkCopied": "Share link copied!",
    "created": "Share link created",
    "deleted": "Share link deleted",
    "failed": "Failed to share: {{message}}"
  },
  "app": {
    "updating": "Updating to latest version..."
  }
}
```

### `share` - Cloud Share Feature (~15 keys)
```json
{
  "status": {
    "idle": "Ready to share",
    "sharing": "Creating share link...",
    "updating": "Updating share...",
    "deleting": "Removing share...",
    "success": "Shared successfully",
    "error": "Share failed"
  },
  "errors": {
    "rateLimited": "Too many requests. Try again in {{minutes}} minute.",
    "rateLimited_other": "Too many requests. Try again in {{minutes}} minutes.",
    "sizeLimit": "Layout is too large (max {{size}}). Try removing some bins.",
    "binLimit": "Too many bins (max {{max}}). Remove some bins before sharing.",
    "contentBlocked": "Content blocked. Please check bin labels and notes for inappropriate content.",
    "notFound": "Share not found or has expired.",
    "unauthorized": "Invalid delete token.",
    "invalidExpiration": "Invalid expiration. Choose 30, 60, 90, or 365 days.",
    "networkError": "Connection failed. Check your internet connection.",
    "unknown": "An error occurred. Please try again."
  },
  "expiration": {
    "days": "Expires in {{count}} day",
    "days_other": "Expires in {{count}} days"
  }
}
```

### `print` - Print List (~20 keys)
```json
{
  "title": "Print List",
  "empty": {
    "noBins": "No bins to print",
    "noBinsPlaced": "No bins placed yet",
    "hint": "Draw bins on the grid to see them here"
  },
  "columns": {
    "size": "Size",
    "quantity": "Qty",
    "filament": "Filament"
  },
  "split": {
    "fits": "Fits print bed",
    "willSplit": "Will be split into {{count}} piece for printing",
    "willSplit_other": "Will be split into {{count}} pieces for printing",
    "exceeds": "Exceeds print bed"
  },
  "export": {
    "copyTsv": "Copy as TSV for spreadsheets",
    "copied": "Copied to clipboard"
  },
  "settings": {
    "printBedSize": "Print Bed Size",
    "gridUnit": "Grid Unit",
    "heightUnit": "Height Unit"
  }
}
```

### `help` - Help Modal & Shortcuts (~50 keys)
```json
{
  "title": "Keyboard Shortcuts",
  "search": "Search shortcuts...",
  "categories": {
    "general": "General",
    "selection": "Selection",
    "navigation": "Navigation",
    "view": "View",
    "bins": "Bins",
    "preview": "3D Preview"
  },
  "shortcuts": {
    "undo": "Undo",
    "redo": "Redo",
    "delete": "Delete selected",
    "duplicate": "Duplicate selection",
    "selectAll": "Select all bins on layer",
    "escape": "Clear selection / Exit mode",
    "zoomIn": "Zoom in",
    "zoomOut": "Zoom out",
    "zoomReset": "Reset zoom",
    "layerUp": "Go to layer above",
    "layerDown": "Go to layer below",
    "prevBin": "Select previous bin",
    "nextBin": "Select next bin",
    "prevCategory": "Previous category",
    "nextCategory": "Next category",
    "quickLabel": "Quick label edit",
    "togglePreview": "Toggle 3D preview",
    "expandPreview": "Expand 3D preview",
    "cameraIsometric": "Isometric view",
    "cameraTop": "Top view",
    "cameraFront": "Front view",
    "cameraSide": "Side view",
    "showHelp": "Show this help"
  },
  "modifiers": {
    "ctrl": "Ctrl",
    "shift": "Shift",
    "alt": "Alt"
  }
}
```

### `aria` - Accessibility Labels (~60 keys)
```json
{
  "bin": {
    "description": "Bin {{width}} by {{depth}}",
    "descriptionWithLabel": "Bin {{width}} by {{depth}}, labeled {{label}}",
    "blockedBy": "Blocked by bin from Layer {{layer}}",
    "resize": {
      "left": "Resize left edge",
      "right": "Resize right edge",
      "top": "Resize top edge",
      "bottom": "Resize bottom edge",
      "topLeft": "Resize top-left corner",
      "topRight": "Resize top-right corner",
      "bottomLeft": "Resize bottom-left corner",
      "bottomRight": "Resize bottom-right corner"
    }
  },
  "navigation": {
    "mainGrid": "Main grid area",
    "layerPanel": "Layer management panel",
    "categoryPanel": "Category panel",
    "inspector": "Selection inspector",
    "printList": "Print list",
    "staging": "Stash area for displaced bins"
  },
  "actions": {
    "togglePanel": "Toggle {{panel}} panel",
    "closeModal": "Close modal",
    "expandSection": "Expand {{section}}",
    "collapseSection": "Collapse {{section}}"
  }
}
```

## Implementation Pattern

### i18n Configuration (`src/i18n/index.ts`)

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all English translations
import en from './locales/en';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en,
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'layout', 'validation', 'toast', 'share', 'print', 'help', 'aria'],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
```

### Custom Hook (`src/hooks/useTranslation.ts`)

```typescript
import { useTranslation as useI18nTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

type Namespace = 'common' | 'layout' | 'validation' | 'toast' | 'share' | 'print' | 'help' | 'aria';

export function useT(ns: Namespace | Namespace[] = 'common') {
  const { t, i18n } = useI18nTranslation(ns);
  return { t, i18n };
}

// Convenience hooks for specific namespaces
export function useCommonT() {
  return useT('common');
}

export function useLayoutT() {
  return useT('layout');
}

export function useValidationT() {
  return useT('validation');
}

// ... etc
```

### Component Usage

```tsx
// Before
<button title="Delete selected bins">Delete</button>

// After
import { useCommonT } from '../hooks/useTranslation';

function MyComponent() {
  const { t } = useCommonT();

  return (
    <button title={t('buttons.delete')}>
      {t('buttons.delete')}
    </button>
  );
}
```

### Pluralization with ICU Format

```tsx
const { t } = useT('toast');

// "Deleted 1 bin" or "Deleted 5 bins"
t('bin.deleted', { count: binCount });
```

### Interpolation

```tsx
const { t } = useT('layout');

// "Switched to \"My Layout\""
t('library.switchTo', { name: layoutName });
```

### Outside React (stores, utils)

```typescript
import i18n from '../i18n';

// In store actions or utility functions
function showValidationError(reason: string) {
  const message = i18n.t(`validation:bin.${reason}`);
  addToast(message, 'error');
}
```

## Bundle Strategy

### Eager Loading (Default)
All English translations bundled with the main app (~5-10KB gzipped). Acceptable for single-language initial release.

### Future: Lazy Loading
For multiple languages, load translations on-demand:

```typescript
i18n.use(Backend).init({
  backend: {
    loadPath: '/locales/{{lng}}/{{ns}}.json',
  },
});
```

## Migration Strategy

### Phase 1: Infrastructure
1. Install dependencies: `i18next`, `react-i18next`, `i18next-browser-languagedetector`
2. Create `src/i18n/` directory structure
3. Create i18n configuration
4. Add `<I18nextProvider>` to App

### Phase 2: Extract Strings (Priority Order)
1. **constants.ts** - Default values (3 strings)
2. **api/share.ts** - Error messages (8 strings)
3. **utils/validation.ts** - Validation errors (15+ strings)
4. **Toast call sites** - Throughout codebase (30+ strings)
5. **Component UI strings** - Incremental extraction

### Phase 3: Component Integration
1. Update components to use `useT()` hook
2. Replace hardcoded strings with `t()` calls
3. Handle pluralization and interpolation

### Phase 4: Testing
1. Add tests for translation key existence
2. Test pluralization edge cases
3. Test language switching

## Type Safety

Create TypeScript definitions for translation keys:

```typescript
// src/i18n/types.ts
import type common from './locales/en/common.json';
import type layout from './locales/en/layout.json';
// ... other namespaces

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      layout: typeof layout;
      // ... etc
    };
  }
}
```

This provides autocomplete and type checking for translation keys.

## Testing Translations

```typescript
// src/test/i18n.test.ts
import i18n from '../i18n';

describe('translations', () => {
  it('has all required common keys', () => {
    expect(i18n.exists('common:buttons.save')).toBe(true);
    expect(i18n.exists('common:buttons.cancel')).toBe(true);
  });

  it('handles pluralization correctly', () => {
    expect(i18n.t('toast:bin.deleted', { count: 1 })).toBe('Deleted 1 bin');
    expect(i18n.t('toast:bin.deleted', { count: 5 })).toBe('Deleted 5 bins');
  });
});
```

## Performance Considerations

1. **Bundle size**: English-only adds ~15KB gzipped (i18next + translations)
2. **Render performance**: `useTranslation` is optimized, minimal re-renders
3. **Memory**: All translations loaded once, cached in memory
4. **Code splitting**: Namespaces allow future lazy loading by feature

## Future Enhancements

1. **Language selector UI** in settings
2. **RTL support** for Arabic, Hebrew
3. **Date/number formatting** with `Intl` API
4. **Translation management** with external tools (Crowdin, Lokalise)
5. **Automatic extraction** with i18next-parser
