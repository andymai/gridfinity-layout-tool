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
}

export function FeetDetachSlider({ value, onChange }: FeetDetachSliderProps) {
  const t = useTranslation();
  return (
    <LidExplodeSlider
      value={value}
      onChange={onChange}
      labels={{
        open: t('binDesigner.preview.feetDetached'),
        closed: t('binDesigner.preview.feetAttached'),
        aria: t('binDesigner.preview.feetDetachSlider'),
      }}
    />
  );
}
