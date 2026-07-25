/**
 * Re-exports the floor pattern's window geometry for cross-feature use (#2816).
 *
 * The window inset is what makes the feature safe — it is the rule that keeps a
 * drainage hole inside a foot's flat underside instead of notching the
 * baseplate-mating taper. The designer needs it too (to predict whether the
 * pattern will fit, and how much material it removes), and re-deriving it there
 * is exactly the kind of drift `printEstimates.ts` already suffers from with the
 * wall-pattern constants. This barrel keeps it a single source instead.
 *
 * The worker module is deliberately brepjs-free, so importing it here does not
 * pull the WASM kernel into the main bundle.
 */

export {
  FLOOR_PATTERN_BORDER,
  floorWindowInset,
  floorWindowSpan,
} from '@/features/generation/worker/generators/floorPatternWindow';
