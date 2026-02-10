# Design Tokens

CSS variables and design tokens used throughout the design system.

## Color Tokens

### Surface Colors (Backgrounds)

| Token                  | CSS Variable     | Value     | Usage           |
| ---------------------- | ---------------- | --------- | --------------- |
| `bg-surface`           | `--bg-primary`   | `#0f0f12` | Main background |
| `bg-surface-secondary` | `--bg-secondary` | `#1a1a1f` | Panels          |
| `bg-surface-elevated`  | `--bg-elevated`  | `#252530` | Cards, elevated |
| `bg-surface-hover`     | `--bg-hover`     | `#2a2a35` | Hover states    |
| `bg-surface-active`    | `--bg-active`    | `#323240` | Active/pressed  |

### Content Colors (Text)

| Token                    | CSS Variable       | Value     | Usage          |
| ------------------------ | ------------------ | --------- | -------------- |
| `text-content`           | `--text-primary`   | `#fafafa` | Primary text   |
| `text-content-secondary` | `--text-secondary` | `#a1a1aa` | Secondary text |
| `text-content-tertiary`  | `--text-tertiary`  | `#8b8c92` | Muted text     |
| `text-content-disabled`  | `--text-disabled`  | `#6b6b75` | Disabled text  |

### Stroke Colors (Borders)

| Token                  | CSS Variable       | Value     | Usage              |
| ---------------------- | ------------------ | --------- | ------------------ |
| `border-stroke`        | `--border-default` | `#3a3a45` | Default borders    |
| `border-stroke-subtle` | `--border-subtle`  | `#2a2a35` | Subtle borders     |
| `border-stroke-strong` | `--border-strong`  | `#4a4a55` | Emphasized borders |

### Semantic Colors

| Token                         | Value     | Usage                  |
| ----------------------------- | --------- | ---------------------- |
| `text-success` / `bg-success` | `#22c55e` | Valid, confirmations   |
| `text-warning` / `bg-warning` | `#f59e0b` | Warnings, caution      |
| `text-error` / `bg-error`     | `#ef4444` | Errors, invalid        |
| `text-danger` / `bg-danger`   | `#dc2626` | Destructive actions    |
| `text-info` / `bg-info`       | `#3b82f6` | Informational          |
| `text-accent` / `bg-accent`   | `#f59e0b` | Primary accent (amber) |

### Muted Semantic Colors (Subtle Backgrounds)

| Token              | Value                      | Usage             |
| ------------------ | -------------------------- | ----------------- |
| `bg-success-muted` | `rgba(34, 197, 94, 0.15)`  | Subtle success bg |
| `bg-warning-muted` | `rgba(245, 158, 11, 0.15)` | Subtle warning bg |
| `bg-error-muted`   | `rgba(239, 68, 68, 0.15)`  | Subtle error bg   |
| `bg-danger-muted`  | `rgba(220, 38, 38, 0.15)`  | Subtle danger bg  |
| `bg-info-muted`    | `rgba(59, 130, 246, 0.15)` | Subtle info bg    |

## Spacing Scale

| Token | Variable      | Value  |
| ----- | ------------- | ------ |
| `xs`  | `--space-xs`  | `4px`  |
| `sm`  | `--space-sm`  | `8px`  |
| `md`  | `--space-md`  | `12px` |
| `lg`  | `--space-lg`  | `16px` |
| `xl`  | `--space-xl`  | `20px` |
| `2xl` | `--space-2xl` | `24px` |
| `3xl` | `--space-3xl` | `32px` |

## Typography Scale

| Token  | Variable      | Value  | Use Case         |
| ------ | ------------- | ------ | ---------------- |
| `xxs`  | `--text-xxs`  | `10px` | Tiny labels      |
| `xs`   | `--text-xs`   | `12px` | Subtle labels    |
| `sm`   | `--text-sm`   | `13px` | Secondary text   |
| `base` | `--text-base` | `14px` | Body text        |
| `lg`   | `--text-lg`   | `16px` | Section headings |
| `xl`   | `--text-xl`   | `18px` | Panel titles     |
| `2xl`  | `--text-2xl`  | `24px` | Page title       |

## Component Size Scale

### Shared scale (Stepper container, Collapsible, etc.)

| Size | Height | Padding  | Icon  | Gap       | Maps to |
| ---- | ------ | -------- | ----- | --------- | ------- |
| `sm` | 24px   | `px-1.5` | 12×12 | `gap-1`   | Compact |
| `md` | 32px   | `px-3`   | 16×16 | `gap-1.5` | Desktop |
| `lg` | 48px   | `px-5`   | 20×20 | `gap-2.5` | Mobile  |

These are defined in `variants.ts` as `sizeHeights` and used for controls that need a fixed container height (e.g. Stepper). **Button, Input, and Select** use intrinsic height from padding at md (~36px), not this scale — see their individual sections below.

### Button (intrinsic height at md)

| Size | Height   | Padding     | Icon-only | Touch target |
| ---- | -------- | ----------- | --------- | ------------ |
| `sm` | 24px     | `px-1.5`    | 24×24     | -            |
| `md` | ~36px \* | `py-2 px-4` | 36×36     | 44px (icon)  |
| `lg` | 48px     | `px-5`      | 48×48     | -            |

\* `md` uses intrinsic height from `py-2` padding (~36px with `text-sm`), matching production `.btn`.
Icon-only buttons get a 44px `touchTarget` by default (per Apple HIG).

### Input (intrinsic height at md)

| Size | Height   | Padding     | Icon  |
| ---- | -------- | ----------- | ----- |
| `sm` | 28px     | `px-2`      | 14×14 |
| `md` | ~36px \* | `py-2 px-3` | 16×16 |
| `lg` | 48px     | `px-4`      | 20×20 |

\* `md` uses intrinsic height from `py-2` padding (~36px with `text-sm`), matching production `.input`.

### Select (intrinsic height at md)

| Size | Height   | Padding     |
| ---- | -------- | ----------- |
| `sm` | 28px     | `px-1.5`    |
| `md` | ~36px \* | `py-2 px-3` |
| `lg` | 48px     | `px-5`      |

\* `md` uses intrinsic height from `py-2` padding (~36px with `text-sm`), matching production `SelectDropdown`.

## Size Tokens

| Variable              | Value   | Usage              |
| --------------------- | ------- | ------------------ |
| `--sidebar-width`     | `256px` | Left sidebar       |
| `--right-panel-width` | `288px` | Right panel        |
| `--header-height`     | `48px`  | Header bar         |
| `--toolbar-height`    | `48px`  | Toolbar            |
| `--touch-target`      | `44px`  | Min touch target   |
| `--radius-sm`         | `4px`   | Small radius       |
| `--radius-md`         | `8px`   | Medium radius      |
| `--radius-lg`         | `12px`  | Large radius       |
| `--radius-xl`         | `16px`  | Extra large radius |

## Shadows

| Variable            | Value                        | Usage             |
| ------------------- | ---------------------------- | ----------------- |
| `--shadow-sm`       | `0 1px 2px rgba(0,0,0,0.2)`  | Subtle depth      |
| `--shadow-md`       | `0 4px 8px rgba(0,0,0,0.25)` | Medium elevation  |
| `--shadow-lg`       | `0 8px 16px rgba(0,0,0,0.3)` | High elevation    |
| `--shadow-elevated` | Complex                      | Elevated surfaces |
| `--shadow-floating` | Complex                      | Floating elements |

## Transitions

| Variable              | Value                                     | Usage                |
| --------------------- | ----------------------------------------- | -------------------- |
| `--transition-fast`   | `100ms ease-out`                          | Micro-interactions   |
| `--transition-normal` | `150ms ease-out`                          | Standard transitions |
| `--transition-slow`   | `250ms ease-out`                          | Larger movements     |
| `--transition-spring` | `200ms cubic-bezier(0.34, 1.56, 0.64, 1)` | Bouncy feedback      |

## Responsive Breakpoints

| Variable          | Value    | Description                |
| ----------------- | -------- | -------------------------- |
| `--breakpoint-sm` | `640px`  | Small devices              |
| `--breakpoint-md` | `768px`  | Tablet (mobile threshold)  |
| `--breakpoint-lg` | `900px`  | Desktop (tablet threshold) |
| `--breakpoint-xl` | `1280px` | Large desktop              |

## Using Tokens in Components

### In Tailwind Classes

```tsx
// Surface colors
<div className="bg-surface" />
<div className="bg-surface-elevated" />

// Content colors
<span className="text-content" />
<span className="text-content-secondary" />

// Borders
<div className="border border-stroke" />
<div className="border border-stroke-subtle" />

// Semantic colors
<span className="text-success" />
<div className="bg-error-muted" />
```

### In CSS

```css
.custom-component {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  transition: all var(--transition-fast);
}
```

### In Inline Styles (Dynamic)

```tsx
// For dynamic colors (e.g., category colors)
<div style={{ backgroundColor: categoryColor }} />
```

## Accessibility Notes

- All text colors meet WCAG 2.1 AA contrast requirements
- `--text-tertiary` has 4.5:1 contrast ratio
- `--text-disabled` has 3:1 contrast ratio (minimum for decorative)
- Focus rings use `--color-primary` (amber) for high visibility
