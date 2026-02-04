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

// ─────────────────────────────────────────────────────────────────────────────
// Shared Tailwind class compositions
// ─────────────────────────────────────────────────────────────────────────────

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
  'disabled:opacity-40',
  'aria-disabled:pointer-events-none',
  'aria-disabled:opacity-40',
] as const;

/**
 * Standard transition for interactive elements.
 */
export const interactiveTransition = 'transition-all duration-100' as const;

/**
 * Touch-friendly minimum size (44px per Apple HIG).
 */
export const touchTarget = 'min-h-[44px] min-w-[44px]' as const;

// ─────────────────────────────────────────────────────────────────────────────
// Size class mappings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Height classes for each size variant.
 */
export const sizeHeights = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-12',
} as const;

/**
 * Padding classes for each size variant.
 */
export const sizePaddings = {
  sm: 'px-3',
  md: 'px-4',
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
 * Gap classes for icon spacing at each size.
 */
export const sizeGaps = {
  sm: 'gap-1.5',
  md: 'gap-2',
  lg: 'gap-2.5',
} as const;

/**
 * Icon sizes (width/height) for each size variant.
 */
export const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Visual variant class mappings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Background and text colors for each visual variant.
 */
export const variantColors = {
  primary: [
    'bg-gradient-to-b from-accent-hover to-accent',
    'text-on-light',
    'shadow-sm',
    'hover:brightness-110 hover:-translate-y-px hover:shadow-md',
    'active:translate-y-0 active:shadow-sm',
  ],
  secondary: [
    'bg-gradient-to-b from-surface-hover to-surface-elevated',
    'text-content',
    'border border-stroke',
    'shadow-sm',
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
  info: 'text-info',
} as const;
