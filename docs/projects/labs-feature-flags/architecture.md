# Labs Feature Flags - Systems Architecture

## Executive Summary

This document describes the architecture for a client-side feature flagging system that allows users to opt into experimental features. The system is designed as a "Labs" feature similar to Google Search Labs, providing a low-friction way to test new features with real users before general availability.

### Key Characteristics

- **User-controlled**: Users explicitly opt into experimental features
- **Client-side only**: No server-side flag evaluation needed
- **Local storage**: Preferences persist across sessions in localStorage
- **Cross-tab sync**: Changes sync automatically via storage events
- **Analytics integration**: Track feature adoption via PostHog
- **Graduation support**: Features can be marked as "graduated" when ready for GA

---

## 1. URL & Entry Points

### Access Patterns

```
Primary entry point:
  Settings menu (new "Labs" button in Sidebar) → Opens Labs drawer

Future entry points:
  - Keyboard shortcut (e.g., Ctrl+Shift+L) - optional
  - Direct link: /#labs (for sharing/docs)
```

### URL Structure

The Labs drawer doesn't require a dedicated route. It operates as an overlay that can be opened from anywhere in the app, preserving the user's current context.

---

## 2. Data Model

### Feature Flag Definition

Feature flags are defined in code as TypeScript constants, providing type safety and versioning with the codebase.

```typescript
// src/labs/types.ts

/**
 * Lifecycle states for experimental features.
 */
export type FeatureStatus =
  | 'experimental'  // Active experiment, may have bugs
  | 'preview'       // More stable, nearing graduation
  | 'graduated'     // Now available to everyone
  | 'deprecated';   // Being phased out

/**
 * Risk level indicators for user awareness.
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Definition of an experimental feature.
 */
export interface FeatureFlag {
  /** Unique identifier (snake_case, matches analytics) */
  id: string;

  /** Display name shown in Labs UI */
  name: string;

  /** Brief description of what the feature does */
  description: string;

  /** Current lifecycle status */
  status: FeatureStatus;

  /** Risk level for user awareness */
  risk: RiskLevel;

  /** Optional warning message for high-risk features */
  warning?: string;

  /** Optional link to documentation or feedback form */
  learnMoreUrl?: string;

  /** Date feature was added to Labs */
  addedAt: string;

  /** Date feature graduated (if applicable) */
  graduatedAt?: string;

  /** Whether enabling requires page refresh */
  requiresRefresh: boolean;

  /** Optional feature dependencies (must be enabled first) */
  dependencies?: string[];
}
```

### Feature Registry

```typescript
// src/labs/features.ts

import type { FeatureFlag } from './types';

/**
 * Registry of all experimental features.
 * Add new features here to make them available in Labs.
 */
export const FEATURE_FLAGS: readonly FeatureFlag[] = [
  {
    id: 'collaborative_editing',
    name: 'Collaborative Editing',
    description: 'Work on layouts together in real-time with other people. Share a link and see each other\'s cursors as you design.',
    status: 'experimental',
    risk: 'medium',
    warning: 'Sessions are temporary and expire after 24 hours. Save your layout locally before ending a session.',
    learnMoreUrl: 'https://github.com/...',
    addedAt: '2026-01',
    requiresRefresh: false,
  },
  {
    id: 'drawer_to_print',
    name: 'Drawer-to-Print Export',
    description: 'Generate STL files for all bins in your layout. Download a complete package with everything you need to 3D print your drawer.',
    status: 'experimental',
    risk: 'low',
    learnMoreUrl: 'https://github.com/...',
    addedAt: '2026-01',
    requiresRefresh: false,
  },
] as const;

/**
 * Type-safe feature IDs derived from the registry.
 */
export type FeatureId = (typeof FEATURE_FLAGS)[number]['id'];

/**
 * Get a feature by ID with type safety.
 */
export function getFeature(id: FeatureId): FeatureFlag | undefined {
  return FEATURE_FLAGS.find(f => f.id === id);
}

/**
 * Get all active (non-deprecated) features.
 */
export function getActiveFeatures(): FeatureFlag[] {
  return FEATURE_FLAGS.filter(f => f.status !== 'deprecated');
}

/**
 * Get graduated features (for "What's New" display).
 */
export function getGraduatedFeatures(): FeatureFlag[] {
  return FEATURE_FLAGS.filter(f => f.status === 'graduated');
}
```

### User Preferences

```typescript
// src/labs/types.ts (continued)

/**
 * User's Labs preferences stored in localStorage.
 */
export interface LabsPreferences {
  /** Map of feature ID → enabled state */
  enabledFeatures: Record<string, boolean>;

  /** Timestamp of last modification (for sync) */
  lastModified: string;

  /** Version for migration support */
  version: number;
}

/**
 * Default preferences for new users.
 */
export const DEFAULT_LABS_PREFERENCES: LabsPreferences = {
  enabledFeatures: {},
  lastModified: new Date().toISOString(),
  version: 1,
};
```

---

## 3. State Management

### Labs Store

A new Zustand store manages Labs state, following existing patterns from `settings.ts`.

```typescript
// src/core/store/labs.ts

import { create } from 'zustand';
import type { LabsPreferences, FeatureId } from '../Labs/types';
import { DEFAULT_LABS_PREFERENCES, FEATURE_FLAGS, getFeature } from '../Labs/features';
import { trackEvent } from '../utils/analytics';

const LABS_STORAGE_KEY = 'gridfinity-labs-v1';

/**
 * Load preferences from localStorage with migration support.
 */
function loadPreferences(): LabsPreferences {
  try {
    const stored = localStorage.getItem(LABS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migration: handle version upgrades here
      return { ...DEFAULT_LABS_PREFERENCES, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load Labs preferences:', e);
  }
  return { ...DEFAULT_LABS_PREFERENCES };
}

/**
 * Save preferences to localStorage.
 */
function savePreferences(prefs: LabsPreferences): void {
  try {
    prefs.lastModified = new Date().toISOString();
    localStorage.setItem(LABS_STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Failed to save Labs preferences:', e);
  }
}

interface LabsState {
  /** User's preferences */
  preferences: LabsPreferences;

  /** Whether Labs drawer is open */
  isDrawerOpen: boolean;

  /** Open the Labs drawer */
  openDrawer: () => void;

  /** Close the Labs drawer */
  closeDrawer: () => void;

  /** Toggle a feature on/off */
  toggleFeature: (featureId: FeatureId) => void;

  /** Enable a specific feature */
  enableFeature: (featureId: FeatureId) => void;

  /** Disable a specific feature */
  disableFeature: (featureId: FeatureId) => void;

  /** Check if a feature is enabled */
  isFeatureEnabled: (featureId: FeatureId) => boolean;

  /** Get count of enabled experimental features */
  getEnabledCount: () => number;

  /** Sync preferences from another tab */
  syncFromStorage: (prefs: LabsPreferences) => void;
}

export const useLabsStore = create<LabsState>()((set, get) => ({
  preferences: loadPreferences(),
  isDrawerOpen: false,

  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),

  toggleFeature: (featureId) => {
    const { preferences } = get();
    const currentlyEnabled = preferences.enabledFeatures[featureId] ?? false;
    const newEnabled = !currentlyEnabled;

    const newPrefs: LabsPreferences = {
      ...preferences,
      enabledFeatures: {
        ...preferences.enabledFeatures,
        [featureId]: newEnabled,
      },
    };

    savePreferences(newPrefs);
    set({ preferences: newPrefs });

    // Track analytics
    trackEvent('labs_feature_toggle', {
      feature_id: featureId,
      enabled: newEnabled,
      feature_status: getFeature(featureId)?.status ?? 'unknown',
    });
  },

  enableFeature: (featureId) => {
    const { preferences } = get();
    if (preferences.enabledFeatures[featureId]) return;

    const newPrefs: LabsPreferences = {
      ...preferences,
      enabledFeatures: {
        ...preferences.enabledFeatures,
        [featureId]: true,
      },
    };

    savePreferences(newPrefs);
    set({ preferences: newPrefs });

    trackEvent('labs_feature_enabled', {
      feature_id: featureId,
      feature_status: getFeature(featureId)?.status ?? 'unknown',
    });
  },

  disableFeature: (featureId) => {
    const { preferences } = get();
    if (!preferences.enabledFeatures[featureId]) return;

    const newPrefs: LabsPreferences = {
      ...preferences,
      enabledFeatures: {
        ...preferences.enabledFeatures,
        [featureId]: false,
      },
    };

    savePreferences(newPrefs);
    set({ preferences: newPrefs });

    trackEvent('labs_feature_disabled', {
      feature_id: featureId,
      feature_status: getFeature(featureId)?.status ?? 'unknown',
    });
  },

  isFeatureEnabled: (featureId) => {
    const { preferences } = get();
    const feature = getFeature(featureId);

    // Graduated features are always enabled
    if (feature?.status === 'graduated') return true;

    // Deprecated features are always disabled
    if (feature?.status === 'deprecated') return false;

    return preferences.enabledFeatures[featureId] ?? false;
  },

  getEnabledCount: () => {
    const { preferences } = get();
    return Object.entries(preferences.enabledFeatures)
      .filter(([id, enabled]) => {
        if (!enabled) return false;
        const feature = getFeature(id as FeatureId);
        // Only count experimental/preview features
        return feature?.status === 'experimental' || feature?.status === 'preview';
      })
      .length;
  },

  syncFromStorage: (prefs) => {
    set({ preferences: prefs });
  },
}));
```

### Usage Hook

```typescript
// src/hooks/useFeatureFlag.ts

import { useLabsStore } from '../store/labs';
import type { FeatureId } from '../Labs/types';

/**
 * Hook to check if a feature flag is enabled.
 * Returns true if the feature is enabled or graduated.
 *
 * @example
 * const isCollabEnabled = useFeatureFlag('collaborative_editing');
 * if (isCollabEnabled) {
 *   // Render collaboration UI
 * }
 */
export function useFeatureFlag(featureId: FeatureId): boolean {
  return useLabsStore((state) => state.isFeatureEnabled(featureId));
}

/**
 * Imperative check for use outside React components.
 *
 * @example
 * if (isFeatureEnabled('drawer_to_print')) {
 *   // Show export option
 * }
 */
export function isFeatureEnabled(featureId: FeatureId): boolean {
  return useLabsStore.getState().isFeatureEnabled(featureId);
}
```

---

## 4. Cross-Tab Synchronization

Extend the existing `useCrossTabSync` hook to handle Labs preferences.

```typescript
// src/hooks/useCrossTabSync.ts (extended)

// Add to existing storage event handler:
if (e.key === 'gridfinity-labs-v1') {
  try {
    const newPrefs = JSON.parse(e.newValue || '{}');
    useLabsStore.getState().syncFromStorage(newPrefs);
  } catch {
    // Ignore parse errors
  }
  return;
}
```

This ensures that when a user toggles a feature in one tab, all other tabs immediately reflect the change.

---

## 5. Analytics Integration

### Events

Labs integrates with the existing PostHog analytics system.

| Event | Properties | When |
|-------|------------|------|
| `labs_drawer_opened` | `enabled_count`, `device_type` | User opens Labs drawer |
| `labs_feature_toggle` | `feature_id`, `enabled`, `feature_status` | User toggles a feature |
| `labs_feature_enabled` | `feature_id`, `feature_status` | Feature specifically enabled |
| `labs_feature_disabled` | `feature_id`, `feature_status` | Feature specifically disabled |

### Periodic Snapshot

Include Labs state in the existing `layout_snapshot` event:

```typescript
// Extend computeLayoutMetrics or add separate function
export function computeLabsMetrics(): LabsMetrics {
  const prefs = useLabsStore.getState().preferences;
  return {
    labs_enabled_features: Object.entries(prefs.enabledFeatures)
      .filter(([_, enabled]) => enabled)
      .map(([id]) => id),
    labs_enabled_count: Object.values(prefs.enabledFeatures)
      .filter(Boolean).length,
  };
}
```

---

## 6. Component Architecture

### New Components

```
src/components/
├── labs/
│   ├── LabsDrawer.tsx          # Main drawer container (slide-in from right)
│   ├── LabsButton.tsx          # Entry point button with badge
│   ├── FeatureCard.tsx         # Individual feature card with toggle
│   ├── FeatureStatusBadge.tsx  # Status indicator (Experimental, Preview, etc.)
│   └── GraduatedSection.tsx    # Optional "What's New" for graduated features
```

### LabsButton Integration

The Labs button should be added to the Sidebar component (desktop) and mobile settings panel (mobile).

```typescript
// Placement in Sidebar
<LabsButton />
// Shows: Flask icon + "Labs" + badge with enabled count
// Badge only visible when count > 0
```

### LabsDrawer Pattern

The drawer follows the existing side panel pattern but slides from the right:

```typescript
// Simplified structure
<div className={`labs-drawer ${isOpen ? 'open' : ''}`}>
  <header>
    <h2>Labs</h2>
    <button onClick={closeDrawer}>×</button>
  </header>

  <p className="description">
    Try experimental features before they're ready for everyone.
    These may be buggy or change without notice.
  </p>

  <div className="features">
    {getActiveFeatures().map(feature => (
      <FeatureCard key={feature.id} feature={feature} />
    ))}
  </div>

  {getGraduatedFeatures().length > 0 && (
    <GraduatedSection features={getGraduatedFeatures()} />
  )}
</div>
```

---

## 7. Feature Integration Pattern

When adding a new experimental feature, follow this pattern:

### 1. Define the Feature

```typescript
// src/labs/features.ts
{
  id: 'new_feature',
  name: 'New Feature',
  description: 'Description of what it does.',
  status: 'experimental',
  risk: 'low',
  addedAt: '2026-02',
  requiresRefresh: false,
}
```

### 2. Gate the Feature

```typescript
// In component
import { useFeatureFlag } from '../hooks/useFeatureFlag';

function MyComponent() {
  const isNewFeatureEnabled = useFeatureFlag('new_feature');

  if (!isNewFeatureEnabled) {
    return null; // Or render fallback
  }

  return <NewFeatureUI />;
}
```

### 3. Gate in Non-React Code

```typescript
// In utility or service
import { isFeatureEnabled } from '../hooks/useFeatureFlag';

function doSomething() {
  if (isFeatureEnabled('new_feature')) {
    // New behavior
  } else {
    // Existing behavior
  }
}
```

---

## 8. Graduation Process

When a feature is ready for general availability:

### 1. Update Feature Status

```typescript
{
  id: 'collaborative_editing',
  status: 'graduated',  // Changed from 'experimental'
  graduatedAt: '2026-03',
  // ... rest unchanged
}
```

### 2. Feature Behavior

- **Graduated features always return `true`** from `isFeatureEnabled()`
- User's previous toggle state is preserved but ignored
- Feature still appears in Labs with "Now available to everyone!" messaging
- Can be hidden from Labs UI after a cooldown period

### 3. Code Cleanup (Optional)

After graduation, feature flag checks can be removed:

```typescript
// Before (with flag)
const isEnabled = useFeatureFlag('collaborative_editing');
if (isEnabled) {
  return <CollabUI />;
}

// After (graduated, flag removed)
return <CollabUI />;
```

---

## 9. Storage Schema

### localStorage Keys

| Key | Content |
|-----|---------|
| `gridfinity-labs-v1` | JSON-serialized `LabsPreferences` |

### Example Stored Data

```json
{
  "enabledFeatures": {
    "collaborative_editing": true,
    "drawer_to_print": false
  },
  "lastModified": "2026-01-14T10:30:00.000Z",
  "version": 1
}
```

### Migration Support

The `version` field enables future migrations:

```typescript
function migratePreferences(stored: unknown): LabsPreferences {
  const prefs = stored as LabsPreferences;

  // v1 → v2 migration (example)
  if (prefs.version === 1) {
    // Perform migration
    prefs.version = 2;
  }

  return prefs;
}
```

---

## 10. File Structure

```
src/
├── labs/
│   ├── index.ts                # Public API exports
│   ├── types.ts                # Type definitions
│   └── features.ts             # Feature registry
│
├── store/
│   └── labs.ts                 # Zustand store
│
├── hooks/
│   └── useFeatureFlag.ts       # React hook + imperative helper
│
├── components/
│   └── labs/
│       ├── LabsDrawer.tsx      # Main drawer
│       ├── LabsButton.tsx      # Entry point with badge
│       ├── FeatureCard.tsx     # Feature toggle card
│       ├── FeatureStatusBadge.tsx
│       └── GraduatedSection.tsx
│
└── utils/
    └── analytics.ts            # Extended with Labs events
```

---

## 11. Security & Privacy

### No Sensitive Data

- Labs stores only feature toggle states
- No user-identifying information
- No server-side persistence

### Analytics Consent

Labs events follow existing PostHog consent patterns:
- Only tracked in production
- Events are anonymized
- Users can disable via browser settings

---

## 12. Performance Considerations

### Bundle Impact

- **Labs store**: ~2KB (similar to existing stores)
- **Labs components**: ~5KB (lazy-loadable)
- **Feature registry**: ~1KB

### Lazy Loading

The Labs drawer can be lazy-loaded since it's not needed on initial render:

```typescript
const LabsDrawer = lazy(() => import('./components/labs/LabsDrawer'));
```

### Storage Event Performance

Storage events are lightweight and handled efficiently by the existing cross-tab sync mechanism.

---

## 13. Testing Strategy

### Unit Tests

- Store actions (toggle, enable, disable, sync)
- Feature lookup functions
- Graduation logic

### Integration Tests

- Cross-tab sync behavior
- Analytics event emission
- Feature flag checks

### E2E Tests

- Open Labs drawer
- Toggle feature and verify UI change
- Cross-tab sync verification

---

## Appendix: Alternatives Considered

### Server-Side Feature Flags

**Rejected because:**
- App is client-side only, no backend auth
- Users should control their own experiments
- Would require additional infrastructure

### Environment Variables

**Rejected because:**
- Can't be changed at runtime
- No per-user control
- Requires rebuild to change

### Third-Party Services (LaunchDarkly, Split)

**Rejected because:**
- User specifically requested no 3rd party dependencies
- Overkill for user-controlled experiments
- Adds external dependency

---

*Document created: 2026-01-14*
*Status: Architecture Plan - Ready for Review*
