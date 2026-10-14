import type { ReactNode } from 'react';
import { Grid3x3Icon, BentoIcon, DividerIcon, ScissorsIcon } from './icons';
import type { InteriorCard } from '../../../types';

interface InteriorModeMeta {
  readonly icon: ReactNode;
  readonly titleKey: string;
  readonly descriptionKey: string;
}

export const INTERIOR_MODE_META: Record<InteriorCard, InteriorModeMeta> = {
  standard: {
    icon: <Grid3x3Icon size={20} className="text-content-secondary" />,
    titleKey: 'binDesigner.interior.standard.title',
    descriptionKey: 'binDesigner.interior.standard.description',
  },
  bento: {
    icon: <BentoIcon size={20} className="text-content-secondary" />,
    titleKey: 'binDesigner.interior.bento.title',
    descriptionKey: 'binDesigner.interior.bento.description',
  },
  slotted: {
    icon: <DividerIcon size={20} className="text-content-secondary" />,
    titleKey: 'binDesigner.interior.slotted.title',
    descriptionKey: 'binDesigner.interior.slotted.description',
  },
  solid: {
    icon: <ScissorsIcon size={20} className="text-content-secondary" />,
    titleKey: 'binDesigner.interior.solid.title',
    descriptionKey: 'binDesigner.interior.solid.description',
  },
};
