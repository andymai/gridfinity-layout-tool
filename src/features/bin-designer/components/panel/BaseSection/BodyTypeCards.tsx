/**
 * The base's archetype, as one exclusive choice.
 *
 * Cards rather than a `SegmentedControl`: this is the most consequential
 * control in the section. It decides whether the bin has walls, a floor or
 * feet at all, and which of the subsections below it even apply, and five
 * labels short enough to fit across the sidebar could not say that. The
 * description is the control's real payload; the label alone does not
 * distinguish a spacer from a base-only plate.
 *
 * Each card holds its own options while selected, so the tray's mating
 * controls live inside the choice that produces them rather than trailing it.
 */

import type { ReactNode } from 'react';
import { useTranslation } from '@/i18n';
import { ModeCard } from '../shared';
import { BODY_TYPES } from './bodyType';
import type { BodyType } from './bodyType';
import { BaseOnlyIcon, BinProfileIcon, FlatBaseIcon, SpacerIcon, StackingTrayIcon } from './icons';

/**
 * Titles reuse the keys the four toggles already had, so the existing
 * translations carry over and only the copy pass touches them.
 */
const TITLE_KEY: Record<BodyType, string> = {
  standard: 'binDesigner.base.bodyType.standard',
  flat: 'binDesigner.flatFloor',
  spacer: 'binDesigner.spacer',
  tile: 'binDesigner.tile',
  tray: 'binDesigner.lidBottom',
};

const DESCRIPTION_KEY: Record<BodyType, string> = {
  standard: 'binDesigner.base.bodyType.standard.description',
  flat: 'binDesigner.base.bodyType.flat.description',
  spacer: 'binDesigner.base.bodyType.spacer.description',
  tile: 'binDesigner.base.bodyType.tile.description',
  tray: 'binDesigner.base.bodyType.tray.description',
};

const ICON: Record<BodyType, ReactNode> = {
  standard: <BinProfileIcon className="text-content-secondary" />,
  flat: <FlatBaseIcon className="text-content-secondary" />,
  spacer: <SpacerIcon className="text-content-secondary" />,
  tile: <BaseOnlyIcon className="text-content-secondary" />,
  tray: <StackingTrayIcon className="text-content-secondary" />,
};

interface BodyTypeCardsProps {
  value: BodyType;
  onChange: (next: BodyType) => void;
  /** Controls and explanations belonging to a type, shown while it is chosen. */
  options?: Partial<Record<BodyType, ReactNode>>;
}

export function BodyTypeCards({ value, onChange, options }: BodyTypeCardsProps) {
  const t = useTranslation();

  return (
    <div role="group" aria-label={t('binDesigner.base.bodyType')} className="space-y-2">
      {BODY_TYPES.map((type) => (
        <ModeCard
          key={type}
          icon={ICON[type]}
          title={t(TITLE_KEY[type])}
          description={t(DESCRIPTION_KEY[type])}
          selected={value === type}
          onSelect={() => onChange(type)}
        >
          {options?.[type]}
        </ModeCard>
      ))}
    </div>
  );
}
