/**
 * Right-edge positions the explode sliders stack into, in the order a caller
 * should fill them. A bin can carry a lid, detachable feet and a knife rest at
 * once, and all three sliders share one anchor.
 *
 * Its own module so the component file exports only components (react-refresh).
 */

export const EXPLODE_SLIDER_SLOTS = ['first', 'second', 'third'] as const;

export type ExplodeSliderSlot = (typeof EXPLODE_SLIDER_SLOTS)[number];

export const EXPLODE_SLIDER_SLOT_POSITION: Record<ExplodeSliderSlot, string> = {
  first: 'right-2',
  second: 'right-16',
  third: 'right-30',
};
