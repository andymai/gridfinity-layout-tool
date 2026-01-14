# Design Requirements: Labs Feature Flags

**Document Version**: 1.0
**Last Updated**: January 2026
**Status**: Draft
**Related Docs**: [PRD](./prd.md) | [Architecture](./architecture.md)

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Color & Visual System](#2-color--visual-system)
3. [Component Specifications](#3-component-specifications)
4. [Layout & Spacing](#4-layout--spacing)
5. [Interaction Patterns](#5-interaction-patterns)
6. [States & Feedback](#6-states--feedback)
7. [Motion & Animation](#7-motion--animation)
8. [Responsive Adaptations](#8-responsive-adaptations)
9. [Accessibility](#9-accessibility)
10. [Design Tokens](#10-design-tokens)
11. [Asset Specifications](#11-asset-specifications)

---

## 1. Design Principles

### 1.1 Core Principles

| Principle | Description | Application |
|-----------|-------------|-------------|
| **Non-Intrusive** | Labs shouldn't distract from core functionality | Subtle entry point, drawer pattern |
| **Transparent** | Users should understand what they're opting into | Clear descriptions, risk indicators |
| **Reversible** | Actions should be easily undoable | Simple toggle, no confirmation dialogs |
| **Discoverable** | Users should find Labs without searching | Badge draws attention when relevant |
| **Consistent** | Labs UI should match existing app patterns | Same drawer, button, and toggle styles |

### 1.2 Design Goals

1. **Zero friction opt-in** - Single click to try a feature
2. **Clear risk communication** - Users understand what's experimental
3. **Minimal cognitive load** - Simple list, not complex configuration
4. **Integration with existing UI** - Feels like part of the app

---

## 2. Color & Visual System

### 2.1 Status Colors

Colors indicate feature maturity level:

| Status | Color | Token | Usage |
|--------|-------|-------|-------|
| Experimental | Amber | `--status-experimental` | High visibility, caution |
| Preview | Blue | `--status-preview` | Positive, nearing completion |
| Graduated | Green | `--status-graduated` | Success, stable |
| Deprecated | Gray | `--status-deprecated` | Low emphasis, phasing out |

**Color Values (Dark Theme):**
```css
--status-experimental: #F59E0B;    /* Amber 500 */
--status-experimental-bg: #78350F; /* Amber 900, 20% opacity */
--status-preview: #3B82F6;         /* Blue 500 */
--status-preview-bg: #1E3A8A;      /* Blue 900, 20% opacity */
--status-graduated: #22C55E;       /* Green 500 */
--status-graduated-bg: #14532D;    /* Green 900, 20% opacity */
--status-deprecated: #6B7280;      /* Gray 500 */
```

### 2.2 Risk Level Colors

| Risk | Icon | Color | Usage |
|------|------|-------|-------|
| Low | 🟢 Circle | Green | Minimal risk, safe to try |
| Medium | ⚠️ Warning | Amber | Some risk, read description |
| High | 🔴 Circle | Red | Significant risk, may cause issues |

**Color Values:**
```css
--risk-low: #22C55E;
--risk-medium: #F59E0B;
--risk-high: #EF4444;
```

### 2.3 Badge Colors

The Labs button badge uses accent colors:

| State | Background | Text |
|-------|------------|------|
| Has enabled features | `--bg-accent/80` | `--text-on-accent` |
| No enabled features | (no badge shown) | — |

---

## 3. Component Specifications

### 3.1 Labs Button

The entry point in the sidebar.

**Default State:**
```
┌───────────────────────────┐
│  🧪  Labs                 │
└───────────────────────────┘
```

**With Enabled Features:**
```
┌───────────────────────────┐
│  🧪  Labs          [2]    │
│                     ↑     │
│                  Badge    │
└───────────────────────────┘
```

**Specifications:**

| Property | Value |
|----------|-------|
| Height | 40px |
| Padding | 8px 12px |
| Icon size | 18px |
| Icon-text gap | 8px |
| Font size | 14px |
| Font weight | 500 (medium) |
| Border radius | 6px |
| Background | `--bg-surface` |
| Background (hover) | `--bg-surface-hover` |
| Text color | `--text-content-secondary` |
| Text color (hover) | `--text-content` |

**Badge Specifications:**

| Property | Value |
|----------|-------|
| Size | 18px × 18px (min) |
| Padding | 2px 6px |
| Font size | 11px |
| Font weight | 600 (semibold) |
| Border radius | 9px (pill) |
| Background | `--bg-accent` |
| Text color | white |
| Max display | "9+" for counts > 9 |

### 3.2 Labs Drawer

The main container for Labs features.

**Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ Header                                                  [×] │
├─────────────────────────────────────────────────────────────┤
│ Description text                                            │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Feature Card 1                                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Feature Card 2                                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                                                             │
│ ▸ Graduated Features (collapsed section)                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Specifications:**

| Property | Value |
|----------|-------|
| Width | 400px (desktop), 100% (mobile) |
| Max width | 100vw |
| Position | Fixed, right side |
| Background | `--bg-surface-elevated` |
| Border left | 1px solid `--border-stroke-subtle` |
| Shadow | `--shadow-xl` |
| Z-index | 100 (above panels, below modals) |
| Padding | 24px |

**Header:**

| Property | Value |
|----------|-------|
| Height | 48px |
| Title font size | 18px |
| Title font weight | 600 |
| Close button | 32px × 32px |
| Bottom border | 1px solid `--border-stroke-subtle` |

**Description:**

| Property | Value |
|----------|-------|
| Font size | 14px |
| Line height | 1.5 |
| Color | `--text-content-secondary` |
| Margin bottom | 24px |

### 3.3 Feature Card

Individual feature display with toggle.

**Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Title]                                  [STATUS BADGE]     │
│                                                             │
│ Description text that explains what the feature does        │
│ and why you might want to enable it.                        │
│                                                             │
│ ⚠️ Warning text for medium/high risk features              │
│                                                             │
│ [Learn more]                                    [━━━○━━━━]  │
│      ↑                                              ↑       │
│   Link (optional)                               Toggle      │
└─────────────────────────────────────────────────────────────┘
```

**Specifications:**

| Property | Value |
|----------|-------|
| Background | `--bg-surface` |
| Border | 1px solid `--border-stroke-subtle` |
| Border radius | 8px |
| Padding | 16px |
| Margin bottom | 12px |

**Title:**

| Property | Value |
|----------|-------|
| Font size | 15px |
| Font weight | 600 |
| Color | `--text-content` |
| Line height | 1.3 |

**Status Badge:**

| Property | Value |
|----------|-------|
| Font size | 10px |
| Font weight | 600 |
| Text transform | uppercase |
| Letter spacing | 0.5px |
| Padding | 4px 8px |
| Border radius | 4px |
| Background | Status color at 20% opacity |
| Text color | Status color |

**Description:**

| Property | Value |
|----------|-------|
| Font size | 13px |
| Line height | 1.5 |
| Color | `--text-content-secondary` |
| Margin top | 8px |

**Warning:**

| Property | Value |
|----------|-------|
| Font size | 12px |
| Line height | 1.4 |
| Color | `--risk-medium` or `--risk-high` |
| Margin top | 12px |
| Padding | 8px 12px |
| Background | Risk color at 10% opacity |
| Border radius | 4px |
| Icon | ⚠️ or appropriate warning icon |

**Learn More Link:**

| Property | Value |
|----------|-------|
| Font size | 12px |
| Color | `--text-accent` |
| Text decoration | none (underline on hover) |

### 3.4 Toggle Switch

Standard toggle following existing app patterns.

**Structure:**
```
Off state:   [━━━●━━━━]
On state:    [━━━━━━●━]
```

**Specifications:**

| Property | Value (Off) | Value (On) |
|----------|-------------|------------|
| Width | 44px | 44px |
| Height | 24px | 24px |
| Background | `--bg-surface-secondary` | `--bg-accent` |
| Border | 1px solid `--border-stroke` | none |
| Border radius | 12px | 12px |
| Knob size | 20px | 20px |
| Knob color | white | white |
| Knob position | left (2px offset) | right (2px offset) |
| Transition | 200ms ease | 200ms ease |

**Graduated State (Always On):**

| Property | Value |
|----------|-------|
| Background | `--bg-success/30` |
| Knob | Checkmark icon or solid |
| Cursor | not-allowed |
| Opacity | 0.7 |

### 3.5 Graduated Section

Collapsible section for graduated features.

**Structure:**
```
▸ What's New (2)
─────────────────────────────────────────────────────────────

Expanded:
▾ What's New (2)
┌─────────────────────────────────────────────────────────────┐
│ ✓ Feature Name                                              │
│   Now available to everyone!                                │
└─────────────────────────────────────────────────────────────┘
```

**Specifications:**

| Property | Value |
|----------|-------|
| Header height | 40px |
| Header font size | 14px |
| Header font weight | 500 |
| Header color | `--text-content-secondary` |
| Chevron size | 16px |
| Divider | 1px dashed `--border-stroke-subtle` |

---

## 4. Layout & Spacing

### 4.1 Drawer Internal Layout

```
┌───────────────────────────────────────────────────────────────┐
│ 24px padding                                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Header (48px)                                           │  │
│  └─────────────────────────────────────────────────────────┘  │
│  16px gap                                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Description                                             │  │
│  └─────────────────────────────────────────────────────────┘  │
│  24px gap                                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Feature Card 1                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│  12px gap                                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Feature Card 2                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│  24px gap                                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Graduated Section                                       │  │
│  └─────────────────────────────────────────────────────────┘  │
│ 24px padding                                                  │
└───────────────────────────────────────────────────────────────┘
```

### 4.2 Feature Card Internal Layout

```
┌───────────────────────────────────────────────────────────────┐
│ 16px padding                                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ [Title]                          [STATUS BADGE]         │  │
│  │ ← Row: justify-between, align-center                    │  │
│  └─────────────────────────────────────────────────────────┘  │
│  8px gap                                                      │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Description paragraph                                   │  │
│  └─────────────────────────────────────────────────────────┘  │
│  12px gap (if warning present)                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ ⚠️ Warning text                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│  16px gap                                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ [Learn more]                            [Toggle]        │  │
│  │ ← Row: justify-between, align-center                    │  │
│  └─────────────────────────────────────────────────────────┘  │
│ 16px padding                                                  │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. Interaction Patterns

### 5.1 Opening Labs Drawer

| Trigger | Behavior |
|---------|----------|
| Click Labs button | Drawer slides in from right (300ms) |
| Keyboard shortcut (future) | Same as click |
| Deep link `/#labs` (future) | Open drawer on page load |

### 5.2 Closing Labs Drawer

| Trigger | Behavior |
|---------|----------|
| Click × button | Drawer slides out (200ms) |
| Press Escape | Same as click × |
| Click backdrop (outside drawer) | Same as click × |

### 5.3 Toggle Feature

| Action | Behavior |
|--------|----------|
| Click toggle (off → on) | Toggle animates to on state, feature enabled |
| Click toggle (on → off) | Toggle animates to off state, feature disabled |
| Click anywhere on card | No effect (only toggle is interactive) |

### 5.4 Expand/Collapse Graduated

| Action | Behavior |
|--------|----------|
| Click section header | Section expands/collapses with animation |
| Chevron rotates | 90° rotation on expand |

---

## 6. States & Feedback

### 6.1 Labs Button States

| State | Appearance |
|-------|------------|
| Default | Normal text, flask icon |
| Hover | Background highlight, slightly brighter text |
| Active (pressed) | Slightly darker background |
| With badge | Badge visible, shows count |

### 6.2 Feature Card States

| State | Appearance |
|-------|------------|
| Disabled | Normal card, toggle off |
| Enabled | Card has subtle highlight border |
| Hover (toggle) | Toggle background slightly lighter |
| Focus (toggle) | Focus ring around toggle |

### 6.3 Toggle States

| State | Visual |
|-------|--------|
| Off | Knob left, gray track |
| On | Knob right, accent track |
| Hover | Track slightly lighter |
| Focus | 2px focus ring |
| Disabled (graduated) | Grayed out, checkmark |

### 6.4 Visual Feedback on Toggle

When a feature is toggled:

1. **Toggle animates** (200ms)
2. **No toast notification** (toggle state is clear)
3. **Badge updates** (if count changes)
4. **Feature activates** (no delay)

---

## 7. Motion & Animation

### 7.1 Drawer Animations

| Animation | Duration | Easing | Property |
|-----------|----------|--------|----------|
| Slide in | 300ms | ease-out | transform: translateX |
| Slide out | 200ms | ease-in | transform: translateX |
| Backdrop fade in | 300ms | ease-out | opacity |
| Backdrop fade out | 200ms | ease-in | opacity |

**CSS:**
```css
.labs-drawer {
  transform: translateX(100%);
  transition: transform 300ms ease-out;
}

.labs-drawer.open {
  transform: translateX(0);
}

.labs-backdrop {
  opacity: 0;
  transition: opacity 300ms ease-out;
}

.labs-backdrop.visible {
  opacity: 1;
}
```

### 7.2 Toggle Animation

| Property | Duration | Easing |
|----------|----------|--------|
| Knob position | 200ms | ease |
| Track color | 200ms | ease |

### 7.3 Collapse Animation

| Property | Duration | Easing |
|----------|----------|--------|
| Section height | 200ms | ease-out |
| Chevron rotation | 200ms | ease |

### 7.4 Reduced Motion

When `prefers-reduced-motion` is enabled:
- Drawer appears instantly (no slide)
- Toggle changes instantly
- Section expands instantly

---

## 8. Responsive Adaptations

### 8.1 Breakpoint Behaviors

| Element | Desktop (≥900px) | Tablet (768-899px) | Mobile (<768px) |
|---------|------------------|--------------------|--------------------|
| Labs button | In sidebar | In sidebar | In mobile settings |
| Drawer width | 400px | 360px | 100% |
| Drawer position | Right side | Right side | Full screen / Bottom sheet |
| Backdrop | Semi-transparent | Semi-transparent | Solid |
| Close method | ×, Escape, backdrop | Same | ×, Escape, swipe down |

### 8.2 Mobile Drawer

On mobile, Labs opens as a full-screen modal or bottom sheet:

```
┌─────────────────────────────────────────┐
│ ─────                                   │  ← Drag handle
│                                         │
│ 🧪 Labs                            [×]  │
│                                         │
│ Try experimental features...            │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Collaborative Editing [EXPERIMENTAL]│ │
│ │                                     │ │
│ │ Work on layouts together...         │ │
│ │                              [━━━○] │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Drawer-to-Print       [EXPERIMENTAL]│ │
│ │                                     │ │
│ │ Generate STL files...               │ │
│ │                              [━━━○] │ │
│ └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

**Mobile-specific specs:**

| Property | Value |
|----------|-------|
| Padding | 16px |
| Feature card margin | 8px |
| Toggle size | 48px × 28px (larger touch target) |
| Min touch target | 44px × 44px |

### 8.3 Mobile Entry Point

On mobile, Labs is accessed via the settings panel:

```
Settings Panel:
┌─────────────────────────────────────────┐
│ Grid Size                               │
│ [width/depth/height controls]           │
│                                         │
│ Physical Units                          │
│ [mm controls]                           │
│                                         │
│ ────────────────────────────────────    │
│                                         │
│ 🧪 Labs                          [2] >  │  ← Tappable row
│                                         │
└─────────────────────────────────────────┘
```

---

## 9. Accessibility

### 9.1 ARIA Roles & Labels

| Element | Role | Label |
|---------|------|-------|
| Labs button | `button` | "Open Labs experimental features" |
| Labs drawer | `dialog` | "Labs experimental features" |
| Close button | `button` | "Close Labs" |
| Feature card | `article` | — |
| Toggle | `switch` | "{Feature name}, {on/off}" |
| Status badge | — | `aria-label="Status: Experimental"` |
| Graduated section | `region` | "Graduated features" |

### 9.2 Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move between interactive elements |
| Enter/Space | Activate button or toggle |
| Escape | Close drawer |
| Arrow keys | Navigate within toggle (not needed) |

**Focus Order:**
1. Close button (×)
2. First feature card toggle
3. Learn more link (if present)
4. Second feature card toggle
5. ...continue through cards
6. Graduated section toggle

### 9.3 Focus Management

- When drawer opens, focus moves to close button or first toggle
- Focus is trapped within drawer while open
- When drawer closes, focus returns to Labs button

### 9.4 Screen Reader Announcements

| Event | Announcement |
|-------|--------------|
| Drawer opens | "Labs dialog opened" |
| Toggle on | "{Feature name} enabled" |
| Toggle off | "{Feature name} disabled" |
| Drawer closes | "Labs dialog closed" |

### 9.5 Color Contrast

All text meets WCAG AA standards:
- Regular text: 4.5:1 minimum
- Large text: 3:1 minimum
- Status badges: Text on colored background meets 4.5:1

---

## 10. Design Tokens

### 10.1 Labs-Specific Tokens

```css
:root {
  /* Status colors */
  --labs-status-experimental: #F59E0B;
  --labs-status-experimental-bg: rgba(245, 158, 11, 0.15);
  --labs-status-preview: #3B82F6;
  --labs-status-preview-bg: rgba(59, 130, 246, 0.15);
  --labs-status-graduated: #22C55E;
  --labs-status-graduated-bg: rgba(34, 197, 94, 0.15);

  /* Risk colors */
  --labs-risk-low: #22C55E;
  --labs-risk-medium: #F59E0B;
  --labs-risk-high: #EF4444;
  --labs-risk-low-bg: rgba(34, 197, 94, 0.1);
  --labs-risk-medium-bg: rgba(245, 158, 11, 0.1);
  --labs-risk-high-bg: rgba(239, 68, 68, 0.1);

  /* Component sizes */
  --labs-drawer-width: 400px;
  --labs-drawer-width-tablet: 360px;
  --labs-toggle-width: 44px;
  --labs-toggle-height: 24px;
  --labs-toggle-mobile-width: 48px;
  --labs-toggle-mobile-height: 28px;

  /* Animation */
  --labs-drawer-duration: 300ms;
  --labs-toggle-duration: 200ms;

  /* Z-index */
  --labs-drawer-z: 100;
  --labs-backdrop-z: 99;
}
```

### 10.2 Component Tokens

```css
/* Labs Button */
--labs-button-height: 40px;
--labs-button-padding: 8px 12px;
--labs-button-icon-size: 18px;
--labs-button-gap: 8px;

/* Badge */
--labs-badge-min-size: 18px;
--labs-badge-padding: 2px 6px;
--labs-badge-font-size: 11px;
--labs-badge-radius: 9px;

/* Feature Card */
--labs-card-padding: 16px;
--labs-card-gap: 12px;
--labs-card-radius: 8px;
```

---

## 11. Asset Specifications

### 11.1 Icons

| Icon | Size | Usage | Source |
|------|------|-------|--------|
| Flask/Beaker | 18px | Labs button | Heroicons or custom |
| Close (×) | 20px | Drawer close | Heroicons |
| Chevron | 16px | Collapse section | Heroicons |
| Warning | 14px | Risk indicator | Heroicons |
| Checkmark | 12px | Graduated toggle | Heroicons |
| External link | 12px | Learn more link | Heroicons |

### 11.2 Flask Icon SVG

```svg
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M9 3h6v6l5 10H4L9 9V3z" />
  <path d="M9 3h6" />
</svg>
```

Alternative (more detailed):
```svg
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
</svg>
```

### 11.3 Status Badge Icons (Optional)

If badges include icons:

| Status | Icon |
|--------|------|
| Experimental | Beaker/Flask (tiny) |
| Preview | Eye |
| Graduated | Checkmark |
| Deprecated | Archive |

---

## Appendix A: Google Labs Reference

The design is inspired by Google Search Labs, with adaptations for our context:

| Google Labs | Our Adaptation |
|-------------|----------------|
| Full-page experience | Side drawer |
| Card illustrations | Text-only cards |
| Thumbs up/down feedback | Simple toggle |
| "Try it" button | Toggle switch |
| Status cards | Status badges |

---

## Appendix B: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01 | Design Team | Initial draft |
