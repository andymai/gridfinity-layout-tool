# Design Requirements: Collaborative Layout Editing

**Document Version**: 2.0
**Last Updated**: January 2026
**Status**: Draft
**Related Docs**: [PRD](./prd.md) | [Architecture](./architecture.md)

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Color System](#2-color-system)
3. [Component Specifications](#3-component-specifications)
4. [Cursor & Presence Design](#4-cursor--presence-design)
5. [Layout & Spacing](#5-layout--spacing)
6. [Interaction Patterns](#6-interaction-patterns)
7. [States & Feedback](#7-states--feedback)
8. [Motion & Animation](#8-motion--animation)
9. [Responsive Adaptations](#9-responsive-adaptations)
10. [Accessibility](#10-accessibility)
11. [Design Tokens](#11-design-tokens)
12. [Asset Specifications](#12-asset-specifications)

---

## 1. Design Principles

### 1.1 Core Principles

| Principle | Description | Application |
|-----------|-------------|-------------|
| **Unobtrusive** | Collaboration UI should enhance, not distract | Cursors fade when idle, minimal chrome |
| **Immediate** | Actions feel instant, presence feels real-time | Optimistic updates, smooth cursor animation |
| **Contextual** | Show information when and where it's needed | Cursor names on hover, contextual tooltips |
| **Familiar** | Match conventions from Google Docs, Figma | Permission selector, participant avatars |
| **Consistent** | Collaboration elements match existing design system | Use existing color tokens, spacing scale |

### 1.2 Design Goals

1. **Zero learning curve** - Users should understand collaboration instantly
2. **Peripheral awareness** - Know who's active without active attention
3. **Non-blocking** - Collaboration UI never prevents primary actions
4. **Graceful degradation** - Works without collaboration, enhances with it

---

## 2. Color System

### 2.1 Participant Colors

A set of 12 distinct, accessible colors assigned to participants in order of joining. Colors are chosen for:
- High contrast against grid background
- Distinguishable from each other
- Readable name labels
- Not conflicting with existing category colors

```
Participant Color Palette:
┌────────────────────────────────────────────────────────────────┐
│  #3B82F6   #8B5CF6   #EC4899   #F97316   #14B8A6   #EAB308   │
│  Blue      Purple    Pink      Orange    Teal      Yellow    │
│                                                                │
│  #EF4444   #22C55E   #06B6D4   #6366F1   #F43F5E   #84CC16   │
│  Red       Green     Cyan      Indigo    Rose      Lime      │
└────────────────────────────────────────────────────────────────┘
```

| Index | Color Name | Hex | RGB | Usage |
|-------|------------|-----|-----|-------|
| 0 | Blue | `#3B82F6` | 59, 130, 246 | First participant (after owner) |
| 1 | Purple | `#8B5CF6` | 139, 92, 246 | Second participant |
| 2 | Pink | `#EC4899` | 236, 72, 153 | Third participant |
| 3 | Orange | `#F97316` | 249, 115, 22 | Fourth participant |
| 4 | Teal | `#14B8A6` | 20, 184, 166 | Fifth participant |
| 5 | Yellow | `#EAB308` | 234, 179, 8 | Sixth participant |
| 6 | Red | `#EF4444` | 239, 68, 68 | Seventh participant |
| 7 | Green | `#22C55E` | 34, 197, 94 | Eighth participant |
| 8 | Cyan | `#06B6D4` | 6, 182, 212 | Ninth participant |
| 9 | Indigo | `#6366F1` | 99, 102, 241 | Tenth participant |
| 10 | Rose | `#F43F5E` | 244, 63, 94 | Eleventh participant |
| 11 | Lime | `#84CC16` | 132, 204, 22 | Twelfth participant |

**Owner color**: Owner uses their assigned color (based on join order, typically first = Blue), but with a crown indicator.

### 2.2 Collaboration Status Colors

| State | Color | Token | Usage |
|-------|-------|-------|-------|
| Connected | `#22C55E` | `--collab-connected` | Status dot, banner accent |
| Reconnecting | `#EAB308` | `--collab-reconnecting` | Warning banner, pulsing dot |
| Disconnected | `#EF4444` | `--collab-disconnected` | Error banner, status dot |
| View-only | `#6B7280` | `--collab-view-only` | Muted indicator |

### 2.3 Interaction Preview Colors

| Element | Fill | Stroke | Opacity |
|---------|------|--------|---------|
| Remote selection | Participant color | Participant color | 10% fill, 100% stroke |
| Remote drag preview | Participant color | Participant color | 15% fill, 50% stroke |
| Remote resize preview | Participant color | Participant color | 15% fill, 50% stroke |
| Remote draw preview | Participant color | Participant color | 20% fill, 100% stroke, dashed |

---

## 3. Component Specifications

### 3.1 Collaboration Header Bar

The header bar updates to show collaboration status and participants when connected.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Layout Name           [Collab Status] [Avatars] [Share ▼] [Menu]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### 3.1.1 Collaboration Status Indicator

**Location**: Left of participant avatars (only visible when collaborating)
**States**:

| State | Icon | Text | Color |
|-------|------|------|-------|
| Connected (edit) | `●` (filled circle) | "Collaborating" | Green |
| Connected (view) | `👁` (eye icon) | "Viewing" | Gray |
| Reconnecting | `●` (pulsing) | "Reconnecting..." | Yellow |

**Specifications**:
- Icon size: 8px diameter
- Font: 13px, medium weight
- Spacing: 6px gap between icon and text
- Click action: Opens share panel

#### 3.1.2 Participant Avatars

**Location**: Header bar, right of status
**Display**: Stacked circular avatars with overlap

```
Desktop (≥900px):
┌─────────────────────────────────┐
│  [A][B][C][D] +3               │
│   ↑  ↑  ↑  ↑   ↑               │
│  Avatars     Overflow count    │
└─────────────────────────────────┘

Mobile (<768px):
┌──────────────┐
│  👥 5        │
│   ↑  ↑       │
│ Icon Count   │
└──────────────┘
```

**Avatar Specifications**:
- Size: 28px diameter (desktop), 24px (tablet)
- Border: 2px solid `--bg-surface` (creates separation)
- Overlap: -8px margin (1/3 overlap)
- Max visible: 4 avatars before "+N" overflow
- Content: First letter of name, uppercase, white text
- Background: Participant color
- Font: 12px, bold

**Overflow Badge**:
- Background: `--bg-surface-secondary`
- Text: `--text-content-secondary`
- Font: 12px
- Padding: 4px 8px
- Border-radius: 12px

**Hover Behavior**:
- Individual avatar: Show tooltip with full name
- Overflow badge: Show dropdown with all participants

#### 3.1.3 Participant Dropdown

**Trigger**: Click on avatars or overflow badge
**Position**: Below avatars, right-aligned

```
┌─────────────────────────────────┐
│ Collaborators (7)               │
├─────────────────────────────────┤
│ 🔵 ● Alex (you)          👑    │
│ 🟣 ● Jordan                    │
│ 🟠 ● Sam                       │
│ 🟡 ○ Guest 4           idle    │
│ 🟢 ● Guest 5                   │
│ 🔴 ● Guest 6                   │
│ 🟤 ● Guest 7                   │
├─────────────────────────────────┤
│ [Copy link]                     │
└─────────────────────────────────┘
```

**Specifications**:
- Width: 240px
- Max height: 320px (scrollable)
- Background: `--bg-surface-elevated`
- Border: 1px solid `--border-stroke-subtle`
- Border-radius: 8px
- Shadow: `--shadow-lg`
- Padding: 8px 0

**Row Specifications**:
- Height: 36px
- Padding: 0 12px
- Hover: `--bg-surface-secondary`

**Elements**:
- Color dot: 12px, participant color
- Activity dot: 6px, green (active) or gray (idle >30s)
- Name: 14px, truncate with ellipsis at 140px
- Crown icon: 16px, for owner only
- "idle" label: 12px, `--text-content-tertiary`

### 3.2 Collaboration Banner

Contextual banner shown below header when collaborating.

#### 3.2.1 Edit Mode Banner (Owner)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ✏️  Collaborating with 3 others                               [Copy Link]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Specifications**:
- Height: 40px
- Background: `--bg-surface-secondary`
- Border-bottom: 1px solid `--border-stroke-subtle`
- Padding: 0 16px
- Icon: 16px
- Text: 14px, `--text-content`
- Layout: Flexbox, space-between

#### 3.2.2 Edit Mode Banner (Participant)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ✏️  Editing Alex's layout with 2 others                       [Save Copy]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### 3.2.3 View-Only Banner

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 👁  Viewing Alex's layout (view-only)                         [Save Copy]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Specifications**:
- Same dimensions as edit banner
- Background: `--bg-warning-muted` (subtle yellow tint)

#### 3.2.4 Connection Status Banners

**Reconnecting**:
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚠️  Connection lost • Reconnecting...                         [Save Copy]    │
└──────────────────────────────────────────────────────────────────────────────┘
```
- Background: `--bg-warning-muted`
- Pulsing animation on icon

**Disconnected (>30s)**:
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ❌  Disconnected • Your changes are saved locally             [Reconnect]    │
└──────────────────────────────────────────────────────────────────────────────┘
```
- Background: `--bg-error-muted`

### 3.3 Share Panel - Unified Design

The share panel is a consolidated experience following Google Docs' model. Permission is controlled via a dropdown, not separate tabs.

#### 3.3.1 Not Yet Shared

```
┌─────────────────────────────────────────────────────────────────┐
│                    Share this layout                        [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Anyone with the link can:                                      │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ View                                                    ▼ │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│              [Share layout]                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Permission Dropdown Options**:
```
┌───────────────────────────────────────────────────────────────┐
│ View                                              (default)   │
│ Others can see but not edit                                   │
├───────────────────────────────────────────────────────────────┤
│ Edit                                                          │
│ Others can make changes in real-time                          │
└───────────────────────────────────────────────────────────────┘
```

#### 3.3.2 Already Shared (View-Only)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Share this layout                        [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Anyone with the link can:                                      │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ View                                                    ▼ │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ https://gridfinity.app/s/abc123xyz789                    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [Copy link]                          Link copied! ✓           │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [Stop sharing]                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.3.3 Already Shared (Edit Mode - Owner)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Share this layout                        [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Anyone with the link can:                                      │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Edit                                                    ▼ │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ https://gridfinity.app/s/abc123xyz789                    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [Copy link]                                                   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Collaborators (3)                                              │
│  🔵 Alex (you) 👑  •  🟣 Jordan  •  🟠 Guest 3                 │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [Stop sharing]                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Specifications**:
- Panel width: 400px (desktop), full-width (mobile)
- Permission dropdown: Full-width, 44px height
- URL input: Read-only, monospace font, select-all on focus
- Collaborators section: Only visible when permission is "Edit"

### 3.4 Join Flow

#### 3.4.1 Loading State

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                                                 │
│                         [Spinner]                               │
│                                                                 │
│                  Joining collaboration...                       │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Full-screen overlay with backdrop blur
- Centered spinner (32px)
- Text: 16px, `--text-content-secondary`

#### 3.4.2 Name Prompt (Optional)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Join Collaboration                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  You're joining Alex's layout.                                  │
│                                                                 │
│  Your name (optional)                                           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Guest                                                     │ │
│  └───────────────────────────────────────────────────────────┘ │
│  This will be shown to other participants.                      │
│                                                                 │
│                                      [Skip]  [Join]             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Input: Auto-focused, max 24 characters
- Pre-filled with "Guest" or stored name from previous collaboration
- Skip button: Secondary style
- Join button: Primary style

#### 3.4.3 Error States

**Layout Not Found**:
```
┌─────────────────────────────────────────────────────────────────┐
│                    Layout Not Found                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                          [Icon: 🔍]                             │
│                                                                 │
│  This layout doesn't exist or has been deleted.                 │
│                                                                 │
│  The link might be incorrect, or the owner may                  │
│  have stopped sharing it.                                       │
│                                                                 │
│                           [Go to Home]                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Layout Busy**:
```
┌─────────────────────────────────────────────────────────────────┐
│                      Layout Busy                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                          [Icon: 👥]                             │
│                                                                 │
│  This layout has too many editors right now.                    │
│                                                                 │
│  Try again in a few minutes, or ask the owner                   │
│  to share a view-only link instead.                             │
│                                                                 │
│                           [Go to Home]                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.5 Stop Sharing Confirmation

**Modal**:
```
┌─────────────────────────────────────────────────────────────────┐
│                      Stop Sharing?                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  This will disconnect all 4 collaborators from your layout.     │
│  They will be prompted to save a copy.                          │
│                                                                 │
│  The share link will stop working.                              │
│                                                                 │
│                           [Cancel]  [Stop Sharing]              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.6 Sharing Stopped (Participant View)

**Modal**:
```
┌─────────────────────────────────────────────────────────────────┐
│                      Sharing Stopped                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Alex has stopped sharing this layout.                          │
│                                                                 │
│  Would you like to save a copy to your library?                 │
│                                                                 │
│                      [No Thanks]  [Save Copy]                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Cursor & Presence Design

### 4.1 Remote Cursor

The cursor shown for other participants on the grid.

```
     ╲
      ╲
       ◢
       └──────────┐
       │  Jordan  │
       └──────────┘
```

**Specifications**:

| Property | Value |
|----------|-------|
| Cursor shape | SVG pointer, 16×20px |
| Cursor color | Participant color (fill) |
| Cursor stroke | White, 1.5px (for contrast) |
| Name label offset | 12px right, 8px down from cursor tip |
| Name label background | Participant color |
| Name label text | White, 11px, medium weight |
| Name label padding | 4px 8px |
| Name label border-radius | 4px |
| Name label max-width | 120px (truncate with ellipsis) |

**Cursor SVG**:
```svg
<svg width="16" height="20" viewBox="0 0 16 20" fill="none">
  <path
    d="M1 1L1 14L5 10L8 17L10 16L7 9L13 9L1 1Z"
    fill="currentColor"
    stroke="white"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
</svg>
```

### 4.2 Cursor States

| State | Appearance |
|-------|------------|
| **Active** | Full opacity cursor + name label |
| **Idle (5-30s)** | 50% opacity, name label fades |
| **Idle (>30s)** | Cursor hidden, dot in participant list turns gray |
| **Outside grid** | Cursor hidden (smoothly fades at edge) |
| **Interaction** | Cursor + interaction preview (see 4.3) |

### 4.3 Interaction Previews

When a remote user is performing an action, show a preview.

#### 4.3.1 Selection Preview

```
┌ ─ ─ ─ ─ ─ ─ ┐
│             │  ← Dashed border in participant color
│   (area)    │
│             │
└ ─ ─ ─ ─ ─ ─ ┘
     ╲
      ◢ Jordan
```

- Border: 2px dashed, participant color
- Fill: Participant color, 10% opacity
- Animate: Marching ants on border (optional)

#### 4.3.2 Drag Preview

```
┌─────────────┐
│   3×2       │  ← Solid border, semi-transparent fill
│             │
└─────────────┘
     ╲
      ◢ Jordan (moving)
```

- Border: 2px solid, participant color, 50% opacity
- Fill: Participant color, 15% opacity
- Name label: Append "(moving)" in italic

#### 4.3.3 Resize Preview

```
┌─────────────────────┐
│                     │
│      Original       │← Ghost of original (dashed)
│                     │
└──────────┬──────────┘
           │
┌──────────┴──────────────────┐
│                             │
│         New size            │← Solid preview
│                             │
└─────────────────────────────┘
                    ╲
                     ◢ Jordan (resizing)
```

- Original: 1px dashed, participant color, 30% opacity
- New size: 2px solid, participant color, 50% opacity
- Name label: Append "(resizing)" in italic

#### 4.3.4 Draw Preview

```
┌ ─ ─ ─ ─ ─ ─ ┐
┊             ┊  ← Dashed border, pulsing
┊  New bin    ┊
┊             ┊
└ ─ ─ ─ ─ ─ ─ ┘
            ╲
             ◢ Jordan (drawing)
```

- Border: 2px dashed, participant color
- Fill: Participant color, 20% opacity
- Animation: Subtle pulse (opacity 20% ↔ 30%)
- Name label: Append "(drawing)" in italic

### 4.4 Cursor Animation

**Movement interpolation**:
- Use CSS transforms for smooth movement
- Interpolate position over 50ms (matches network update rate)
- Ease-out timing function

**Fade transitions**:
- Idle fade: 300ms ease-out
- Exit fade: 200ms ease-out
- Entry: Instant (no delay)

```css
.remote-cursor {
  transition:
    transform 50ms ease-out,
    opacity 300ms ease-out;
}
```

---

## 5. Layout & Spacing

### 5.1 Z-Index Layers

| Layer | Z-Index | Contents |
|-------|---------|----------|
| Grid cells | 0 | Background grid |
| Bins | 10 | User's bins |
| Local interaction preview | 20 | User's drag/resize preview |
| Remote interaction previews | 30 | Others' drag/resize previews |
| Remote cursors | 40 | Others' cursors |
| UI overlays | 50+ | Modals, dropdowns, tooltips |

### 5.2 Header Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 16px │ Logo │ 12px │ Name │ ←──flex──→ │ Status │ 8px │ Avatars │ 16px │  │
└────────────────────────────────────────────────────────────────────────────┘
         48px          flex-1              auto      28px×4        48px
```

### 5.3 Banner Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 16px │ Icon │ 8px │ Message │ ←──flex──→ │ Actions │ 16px │
└────────────────────────────────────────────────────────────────────────────┘
        16px          flex-1                 auto
```

Height: 40px
Vertical alignment: Center

---

## 6. Interaction Patterns

### 6.1 Collaboration Entry Points

| Entry Point | Location | Action |
|-------------|----------|--------|
| Share button | Header | Opens share panel |
| Keyboard shortcut | Global | `Ctrl/Cmd + Shift + S` opens share panel |

### 6.2 Joining Interactions

| Interaction | Behavior |
|-------------|----------|
| Click share link | Opens app, checks permission, shows loading, joins (view or edit mode) |
| Click share link (app open) | Prompts to leave current layout, join new |
| Paste share URL in address bar | Same as click |
| Deep link with name param (`?name=`) | Skips name prompt, uses param value |

### 6.3 In-Collaboration Interactions

| Interaction | Owner | Edit Participant | View Participant |
|-------------|-------|------------------|------------------|
| Draw bin | ✓ | ✓ | Disabled (cursor shows 🚫) |
| Move bin | ✓ | ✓ | Disabled |
| Resize bin | ✓ | ✓ | Disabled |
| Edit properties | ✓ | ✓ | Disabled |
| Add layer/category | ✓ | ✓ | Disabled |
| Change drawer size | ✓ | ✓ | Disabled |
| Zoom/pan | ✓ Local | ✓ Local | ✓ Local |
| Toggle 3D preview | ✓ Local | ✓ Local | ✓ Local |
| Copy link | ✓ | ✓ | ✓ |
| Save copy | ✓ | ✓ | ✓ |
| Change permission | ✓ | — | — |
| Stop sharing | ✓ | — | — |

### 6.4 Tooltips & Help

| Element | Tooltip |
|---------|---------|
| Status indicator | "3 people collaborating" |
| Participant avatar | "Jordan - Click to see all collaborators" |
| Crown icon | "Layout owner" |
| Disabled edit control | "View-only mode - You can't edit this layout" |
| Copy link button | "Copy share link" |
| Permission dropdown | "Change who can edit" |

---

## 7. States & Feedback

### 7.1 Connection States

| State | Header Status | Banner | Cursors | Actions |
|-------|---------------|--------|---------|---------|
| **Connecting** | Spinner | "Joining..." | Hidden | Disabled |
| **Connected (edit)** | Green dot + "Collaborating" | Edit banner | Visible | Enabled |
| **Connected (view)** | Gray eye + "Viewing" | View-only banner | Visible | Disabled |
| **Reconnecting** | Yellow dot (pulsing) | "Reconnecting..." | Frozen | Queued |
| **Disconnected** | Red dot | Error banner | Hidden | Local only |

### 7.2 Operation Feedback

| Operation | Success Feedback | Error Feedback |
|-----------|------------------|----------------|
| Share layout | Toast: "Layout shared", URL copied | Toast: error message |
| Join collaboration | Banner appears, cursors load | Error modal |
| Change permission | Toast: "Permission updated" | Toast: error message |
| Send edit | Immediate (optimistic) | Toast: "Change couldn't be saved" |
| Stop sharing | Panel closes, banner removed | Toast: error message |

### 7.3 Participant Events

| Event | Visual Feedback |
|-------|-----------------|
| Participant joins | Toast: "Jordan joined", avatar appears |
| Participant leaves | Toast: "Jordan left", avatar fades out |
| Participant idle | Gray dot in list, cursor fades |
| Participant active | Green dot, cursor reappears |

Toast duration: 3 seconds
Avatar animation: 200ms fade

### 7.4 View-Only Restrictions

When a view-only participant tries to edit:

- Cursor: Show 🚫 cursor on hover over interactive elements
- Click: Nothing happens (no error, just no response)
- Keyboard shortcuts: Disabled for edit actions
- UI: Edit buttons visually disabled (grayed out, 50% opacity)
- Tooltip: "View-only mode - You can't edit this layout"

---

## 8. Motion & Animation

### 8.1 Cursor Motion

| Property | Value | Easing |
|----------|-------|--------|
| Position interpolation | 50ms | ease-out |
| Idle fade | 300ms | ease-out |
| Exit fade | 200ms | ease-out |
| Name label appear | 150ms | ease-out |

### 8.2 Avatar Animations

| Property | Value | Easing |
|----------|-------|--------|
| Join (scale in) | 200ms, scale 0→1 | spring (0.5, 0.9) |
| Leave (fade out) | 200ms, opacity 1→0 | ease-out |
| Reorder (position) | 200ms | ease-in-out |

### 8.3 Banner Animations

| Property | Value | Easing |
|----------|-------|--------|
| Appear (slide down) | 200ms, translateY -100%→0 | ease-out |
| Disappear (slide up) | 150ms, translateY 0→-100% | ease-in |
| Color change | 300ms | ease-in-out |

### 8.4 Interaction Preview Animations

| Animation | Value |
|-----------|-------|
| Selection marching ants | 1s linear infinite |
| Draw preview pulse | 1s ease-in-out infinite (opacity 20%↔30%) |
| Resize preview snap | 100ms ease-out |

### 8.5 Loading States

| Element | Animation |
|---------|-----------|
| Join spinner | Rotate 360° over 1s, linear, infinite |
| Reconnecting indicator | Pulse opacity 50%↔100% over 1s, infinite |
| Status dot pulse | Scale 1→1.2→1 over 2s, ease-in-out, infinite |

---

## 9. Responsive Adaptations

### 9.1 Breakpoint Behaviors

| Element | Desktop (≥900px) | Tablet (768-899px) | Mobile (<768px) |
|---------|------------------|--------------------|--------------------|
| Participant avatars | Show 4 + overflow | Show 3 + overflow | Count only (👥 5) |
| Collaboration banner | Full text | Shortened text | Icon + count |
| Cursor name labels | Always visible | Visible | Hidden (icon only) |
| Participant dropdown | Click to expand | Click to expand | Bottom sheet |
| Share panel | 400px floating | 400px floating | Full-screen |

### 9.2 Mobile-Specific Designs

#### 9.2.1 Mobile Header

```
┌────────────────────────────────────────────────────┐
│ [←] Layout Name           [👥 5] [●] [Share] [⋮]  │
└────────────────────────────────────────────────────┘
```

- Avatars replaced with count badge
- Status dot smaller (6px)
- Tap count to open participant sheet

#### 9.2.2 Mobile Participant Sheet

```
┌────────────────────────────────────────────────────┐
│ ─────                                              │  ← Drag handle
│                                                    │
│ Collaborators (5)                                  │
│                                                    │
│ ┌────────────────────────────────────────────────┐│
│ │ 🔵 Alex (you)                            👑   ││
│ │ 🟣 Jordan                                     ││
│ │ 🟠 Sam                                        ││
│ │ 🟡 Guest 4                              idle  ││
│ │ 🟢 Guest 5                                    ││
│ └────────────────────────────────────────────────┘│
│                                                    │
│ [Copy link]                                       │
│                                                    │
└────────────────────────────────────────────────────┘
```

- Bottom sheet with drag-to-dismiss
- Row height: 48px (touch-friendly)
- Full-width on mobile

#### 9.2.3 Mobile Cursors

On mobile, remote cursors are simplified:
- Show colored dot (12px) instead of full cursor
- No name label (too cluttered)
- Tap dot to see participant name in tooltip
- Interaction previews still shown (selection boxes, etc.)

### 9.3 Touch Interactions

| Desktop | Mobile Equivalent |
|---------|-------------------|
| Hover on avatar | Tap to expand |
| Right-click context menu | Long-press |
| Hover tooltip | Tap and hold |
| Cursor following mouse | Touch point indicator |

---

## 10. Accessibility

### 10.1 ARIA Roles & Labels

| Element | Role | Label |
|---------|------|-------|
| Participant list | `region` | "Collaboration participants" |
| Participant avatar | `img` | "Jordan, participant" |
| Status indicator | `status` | "Connected to collaboration with 5 participants" |
| Remote cursor | `img` | "Jordan's cursor at position 3, 5" |
| Collaboration banner | `status` | Dynamic based on content |

### 10.2 Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Navigate through collaboration UI elements |
| `Enter/Space` | Activate focused element (buttons, links) |
| `Escape` | Close dropdown/modal |
| `Ctrl/Cmd + Shift + S` | Open share panel |
| `Ctrl/Cmd + Shift + C` | Copy share link |

### 10.3 Screen Reader Announcements

| Event | Announcement |
|-------|--------------|
| Collaboration joined | "Joined collaboration with 3 participants" |
| Participant joined | "Jordan joined" |
| Participant left | "Jordan left" |
| Permission changed | "Layout is now view-only" / "Layout is now editable" |
| Connection lost | "Connection lost. Attempting to reconnect." |
| Reconnected | "Reconnected to collaboration" |

### 10.4 Reduced Motion

When `prefers-reduced-motion` is enabled:
- Cursor movement: Instant (no interpolation)
- Avatar animations: Instant appear/disappear
- Banner transitions: Instant
- Loading spinners: Static icon or progress bar

### 10.5 Color Contrast

All participant colors meet WCAG AA for:
- White text on color background (name labels)
- Color on grid background (cursors)

Minimum contrast ratios:
- Name labels: 4.5:1 (white on participant color)
- Status text: 4.5:1 (text on banner background)

---

## 11. Design Tokens

### 11.1 New Tokens

```css
:root {
  /* Participant colors */
  --collab-color-0: #3B82F6;  /* Blue */
  --collab-color-1: #8B5CF6;  /* Purple */
  --collab-color-2: #EC4899;  /* Pink */
  --collab-color-3: #F97316;  /* Orange */
  --collab-color-4: #14B8A6;  /* Teal */
  --collab-color-5: #EAB308;  /* Yellow */
  --collab-color-6: #EF4444;  /* Red */
  --collab-color-7: #22C55E;  /* Green */
  --collab-color-8: #06B6D4;  /* Cyan */
  --collab-color-9: #6366F1;  /* Indigo */
  --collab-color-10: #F43F5E; /* Rose */
  --collab-color-11: #84CC16; /* Lime */

  /* Status colors */
  --collab-status-connected: #22C55E;
  --collab-status-reconnecting: #EAB308;
  --collab-status-disconnected: #EF4444;
  --collab-status-view-only: #6B7280;

  /* Sizes */
  --collab-avatar-size: 28px;
  --collab-avatar-size-sm: 24px;
  --collab-cursor-size: 16px;
  --collab-status-dot: 8px;
  --collab-activity-dot: 6px;

  /* Animation */
  --collab-cursor-transition: 50ms ease-out;
  --collab-fade-transition: 300ms ease-out;
  --collab-avatar-transition: 200ms ease-out;

  /* Z-index */
  --collab-z-remote-preview: 30;
  --collab-z-cursor: 40;
}
```

### 11.2 Component Tokens

```css
/* Avatar */
--collab-avatar-border: 2px solid var(--bg-surface);
--collab-avatar-overlap: -8px;
--collab-avatar-font: 12px bold;

/* Cursor */
--collab-cursor-stroke: 1.5px white;
--collab-cursor-label-padding: 4px 8px;
--collab-cursor-label-radius: 4px;
--collab-cursor-label-font: 11px medium;
--collab-cursor-label-max-width: 120px;

/* Banner */
--collab-banner-height: 40px;
--collab-banner-padding: 0 16px;
--collab-banner-font: 14px;

/* Preview */
--collab-preview-stroke: 2px;
--collab-preview-fill-opacity: 0.15;
--collab-preview-stroke-opacity: 0.5;
```

---

## 12. Asset Specifications

### 12.1 Icons

| Icon | Size | Usage | Source |
|------|------|-------|--------|
| Cursor pointer | 16×20 | Remote cursor | Custom SVG |
| Crown | 16×16 | Owner indicator | Heroicons |
| Users | 16×16 | Participant count (mobile) | Heroicons |
| Eye | 16×16 | View-only indicator | Heroicons |
| Link | 16×16 | Copy link action | Heroicons |
| Refresh | 16×16 | Reconnecting | Heroicons (animated) |

### 12.2 Cursor SVG

```svg
<!-- Remote cursor pointer -->
<svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path
    d="M1 1L1 14L5 10L8 17L10 16L7 9L13 9L1 1Z"
    fill="var(--cursor-color)"
    stroke="white"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
</svg>
```

### 12.3 Status Dot SVG

```svg
<!-- Connected dot -->
<svg width="8" height="8" viewBox="0 0 8 8" fill="none">
  <circle cx="4" cy="4" r="4" fill="var(--collab-status-connected)"/>
</svg>

<!-- Reconnecting dot (animated) -->
<svg width="8" height="8" viewBox="0 0 8 8" fill="none">
  <circle cx="4" cy="4" r="4" fill="var(--collab-status-reconnecting)">
    <animate attributeName="opacity" values="0.5;1;0.5" dur="1s" repeatCount="indefinite"/>
  </circle>
</svg>
```

### 12.4 Empty States

**Layout Not Found**:
- Illustration: Magnifying glass with question mark
- Size: 120×120px
- Style: Line art, `--text-content-tertiary` color

**Layout Busy**:
- Illustration: Group of people with "full" indicator
- Size: 120×120px
- Style: Line art, `--text-content-tertiary` color

---

## Appendix A: Google Docs/Figma Reference

Design patterns borrowed from established collaborative tools:

| Pattern | Source | Our Implementation |
|---------|--------|-------------------|
| Permission dropdown | Google Docs | Similar (View/Edit options) |
| Stacked avatars | Figma | Identical |
| Colored cursor with name | Figma, Miro | Identical |
| Connection status banner | Google Docs | Similar |
| Participant dropdown | Figma | Similar |
| View-only indicator | Google Docs | Banner + disabled controls |
| Cursor fade on idle | Figma | 5 seconds, configurable |

---

## Appendix B: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01 | Design Team | Initial draft with session-based UI |
| 2.0 | 2026-01 | Design Team | Revised to Google Docs model, unified share panel |
