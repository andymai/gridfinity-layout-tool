/**
 * Drops the detachable feet away from the bin so the joint can be inspected.
 *
 * The lid's slider with its own copy rather than a second implementation: the
 * track, the drag handling and the keyboard behaviour are identical, and only
 * what the two ends MEAN differs.
 */

import { useTranslation } from '@/i18n';
import { LidExplodeSlider } from '../LidExplodeSlider';

interface FeetDetachSliderProps {
  value: number;
  onChange: (mm: number) => void;
  /** True when the lid's slider is on screen too, so the two must not overlap. */
  showsBesideLid?: boolean;
}

export function FeetDetachSlider({
  value,
  onChange,
  showsBesideLid = false,
}: FeetDetachSliderProps) {
  const t = useTranslation();
  return (
    <LidExplodeSlider
      value={value}
      onChange={onChange}
      // Inverted, and the labels follow: the feet drop DOWNWARD off the bin, so
      // dragging down has to be what detaches them. With the lid's orientation
      // the hand and the part moved opposite ways.
      invert
      slot={showsBesideLid ? 'second' : 'first'}
      labels={{
        open: t('binDesigner.preview.feetAttached'),
        closed: t('binDesigner.preview.feetDetached'),
        aria: t('binDesigner.preview.feetDetachSlider'),
      }}
    />
  );
}
