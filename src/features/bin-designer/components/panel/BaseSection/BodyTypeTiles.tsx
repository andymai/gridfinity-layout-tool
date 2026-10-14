/**
 * The base's archetype, as one exclusive choice: the most consequential control
 * in the section, since it decides whether the bin has walls, a floor or feet
 * at all. The chosen type's caption says what it is, and the tray's mating
 * controls sit under the choice that produces them.
 */

import type { ReactNode } from 'react';
import { useTranslation } from '@/i18n';
import { ModeTiles } from '../shared';
import { BODY_TYPES } from './bodyType';
import type { BodyType } from './bodyType';
import {
  BaseOnlyIcon,
  BinProfileIcon,
  FlatBaseIcon,
  LidBaseIcon,
  SpacerIcon,
  NestingIcon,
} from './icons';

/**
 * Titles reuse the keys the four toggles already had, so the existing
 * translations carry over and only the copy pass touches them.
 */
const TITLE_KEY: Record<BodyType, string> = {
  standard: 'binDesigner.base.bodyType.standard',
  nesting: 'binDesigner.base.bodyType.nesting',
  flat: 'binDesigner.flatFloor',
  spacer: 'binDesigner.spacer',
  tile: 'binDesigner.tile',
  tray: 'binDesigner.lidBottom',
};

const DESCRIPTION_KEY: Record<BodyType, string> = {
  standard: 'binDesigner.base.bodyType.standard.description',
  nesting: 'binDesigner.base.bodyType.nesting.description',
  flat: 'binDesigner.base.bodyType.flat.description',
  spacer: 'binDesigner.base.bodyType.spacer.description',
  tile: 'binDesigner.base.bodyType.tile.description',
  tray: 'binDesigner.base.bodyType.tray.description',
};

const ICON: Record<BodyType, ReactNode> = {
  standard: <BinProfileIcon className="text-content-secondary" />,
  nesting: <NestingIcon className="text-content-secondary" />,
  flat: <FlatBaseIcon className="text-content-secondary" />,
  spacer: <SpacerIcon className="text-content-secondary" />,
  tile: <BaseOnlyIcon className="text-content-secondary" />,
  tray: <LidBaseIcon className="text-content-secondary" />,
};

interface BodyTypeTilesProps {
  value: BodyType;
  onChange: (next: BodyType) => void;
  /** Controls belonging to a type, shown while it is chosen. */
  options?: Partial<Record<BodyType, ReactNode>>;
}

export function BodyTypeTiles({ value, onChange, options }: BodyTypeTilesProps) {
  const t = useTranslation();

  return (
    <ModeTiles
      ariaLabel={t('binDesigner.base.bodyType')}
      value={value}
      onChange={onChange}
      options={BODY_TYPES.map((type) => ({
        value: type,
        icon: ICON[type],
        label: t(TITLE_KEY[type]),
        caption: t(DESCRIPTION_KEY[type]),
      }))}
    >
      {options?.[value]}
    </ModeTiles>
  );
}
