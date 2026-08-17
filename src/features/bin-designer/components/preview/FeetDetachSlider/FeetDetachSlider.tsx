/**
 * Drops the detachable feet away from the bin so the joint can be inspected.
 *
 * The lid's slider with its own copy rather than a second implementation: the
 * track, the drag handling and the keyboard behaviour are identical, and only
 * what the two ends MEAN differs. It is a separate control from the lid's
 * because the parts move in opposite directions and a bin can have feet
 * without having a lid at all — sharing one value stranded the feet 30mm down
 * on a lidless bin, where the slider that set it is never rendered.
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
