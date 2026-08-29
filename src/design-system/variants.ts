/**
 * Shared CVA variant definitions for the design system.
 *
 * These provide consistent size and visual variant scales across all components.
 * Import individual variants or the compound configurations.
 */

/**
 * Standard size scale used across components.
 * - sm: Compact UI, dense layouts
 * - md: Default size for most contexts
 * - lg: Touch-friendly, prominent actions
 */
export const sizeScale = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
} as const;

export type Size = keyof typeof sizeScale;

/**
 * Visual variant scale for interactive elements.
 * - primary: Main action, draws attention (amber)
 * - secondary: Default, neutral actions (gray)
 * - ghost: Minimal, transparent until hovered
 * - danger: Destructive actions (red)
 */
export const variantScale = {
  primary: 'primary',
  secondary: 'secondary',
  ghost: 'ghost',
  danger: 'danger',
} as const;

export type Variant = keyof typeof variantScale;

/**
 * Intent-based color scale for feedback and status.
 * Used by Toast, Badge, and validation states.
 */
export const intentScale = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
} as const;

export type Intent = keyof typeof intentScale;

// Shared Tailwind class compositions

/**
 * Base focus styles using inset outline to prevent clipping in overflow containers.
 */
export const focusRing = [
  'focus-visible:outline-2',
  'focus-visible:outline-offset-[-2px]',
  'focus-visible:outline-accent',
] as const;

/**
 * Disabled state styles applied consistently.
 */
export const disabledStyles = [
  'disabled:pointer-events-none',
  'disabled:opacity-50',
  'disabled:grayscale-[0.2]',
  'aria-disabled:pointer-events-none',
  'aria-disabled:opacity-50',
  'aria-disabled:grayscale-[0.2]',
] as const;

/**
 * Standard transition for interactive elements.
 */
export const interactiveTransition =
  'transition-all duration-(--motion-fast) ease-(--ease-out-quart)' as const;

/**
 * Tactile press feedback for buttons and interactive elements.
 */
export const activePress = 'active:scale-[0.98]' as const;

/**
 * Touch-friendly minimum size (44px per Apple HIG).
 */
export const touchTarget = 'min-h-[44px] min-w-[44px]' as const;

/**
 * Pro-compact control row heights (tokens --control-h-sm/-md). Adopted
 * control-by-control; existing 36px intrinsic-height controls keep their
 * size until they are rebuilt on this scale.
 */
export const controlHeights = {
  sm: 'h-6',
  md: 'h-7',
} as const;

/**
 * Standard control row layout at the md control height.
 */
export const controlRow = 'flex h-7 items-center gap-2' as const;

/**
 * Hairline border: 1px, thinning to 0.5px on high-density screens
 * (the `hairline` utility in index.css), in the subtle stroke color.
 */
export const hairline = 'hairline border-stroke-subtle' as const;

// Size class mappings

/**
 * Height classes for non-input interactive controls (e.g. Stepper container).
 *
 * Button, Input, and Select use intrinsic height from padding at md (~36px),
 * not this explicit h-8 (32px). Only use sizeHeights for controls that need
 * a fixed container height independent of content.
 */
export const sizeHeights = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-12',
} as const;

/**
 * Padding classes for each size variant.
 */
export const sizePaddings = {
  sm: 'px-1.5',
  md: 'px-3',
  lg: 'px-5',
} as const;

/**
 * Text size classes for each size variant.
 */
export const sizeText = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
} as const;

/**
 * Role-based type ramp. Each class carries size, line-height, tracking and
 * weight for one UI role (tokens defined in src/index.css @theme). Prefer
 * these over raw text-* sizes for UI chrome:
 * - micro: unit suffixes, tiny badges (10px)
 * - label: control labels (11px)
 * - value: numeric values, tabular figures (12px)
 * - body: panel copy (13px)
 * - section: uppercase section headers (11px, wide tracking)
 * - title: panel/dialog titles (14px)
 * - page: page titles (18px)
 */
export const typeRamp = {
  micro: 'text-micro',
  label: 'text-label',
  value: 'text-value tabular-nums',
  body: 'text-body',
  section: 'text-section uppercase',
  title: 'text-title',
  page: 'text-page',
} as const;

export type TypeRole = keyof typeof typeRamp;

/**
 * Gap classes for icon spacing at each size.
 */
export const sizeGaps = {
  sm: 'gap-1',
  md: 'gap-1.5',
  lg: 'gap-2.5',
} as const;

/**
 * Icon sizes (width/height) for each size variant.
 */
export const iconSizes = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
} as const;

// Visual variant class mappings

/**
 * Background and text colors for each visual variant.
 */
export const variantColors = {
  primary: [
    'bg-gradient-to-b from-accent-hover to-accent',
    'text-on-accent',
    'shadow-sm',
    'hover:brightness-110 hover:-translate-y-px hover:shadow-md',
    'active:translate-y-0 active:shadow-sm',
  ],
  secondary: [
    'bg-gradient-to-b from-surface-hover to-surface-elevated',
    'text-content',
    'border border-stroke',
    'shadow-sm inset-shadow-[0_1px_0_rgba(255,255,255,0.03)]',
    'hover:from-surface-active hover:to-surface-hover hover:-translate-y-px hover:shadow-md',
    'active:translate-y-0 active:shadow-sm',
  ],
  ghost: ['bg-transparent', 'text-content-secondary', 'hover:bg-surface-hover hover:text-content'],
  danger: [
    'bg-gradient-to-b from-error to-danger',
    'text-white',
    'shadow-sm',
    'hover:brightness-110 hover:-translate-y-px',
    'active:translate-y-0',
  ],
} as const;

/**
 * Intent-based background colors (muted versions for subtle feedback).
 */
export const intentBackgrounds = {
  success: 'bg-success-muted',
  warning: 'bg-warning-muted',
  error: 'bg-error-muted',
  info: 'bg-info-muted',
} as const;

/**
 * Intent-based text colors.
 */
export const intentText = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  // Paired with intentBackgrounds.info, where plain text-info measured 4.42:1
  // in the dark theme. See --color-info-strong.
  info: 'text-info-strong',
} as const;
