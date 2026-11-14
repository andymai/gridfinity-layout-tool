/**
 * Compact "Baseplate" switcher for the planner sidebar: a Select bound to the
 * global baseplate library plus a manage affordance that opens the library
 * modal.
 *
 * A `StickyGroupHeader` group with the manage button in `actions`, so it reads
 * as a peer of Layers and Categories; the icon button matches theirs, since all
 * three sit in the same column.
 */

import { useCallback } from 'react';
import { useViewStore } from '@/core/store/view';
import { useTranslation } from '@/i18n';
import { IconButton, Select } from '@/design-system';
import { LayoutGridIcon } from '@/design-system/Icon';
import { baseplateDesignId } from '@/core/types';
import { useBaseplateLibrary } from '@/features/baseplate/hooks/useBaseplateLibrary';
import { PanelSection } from '@/shared/components/PanelSection';
import { StickyGroupHeader } from '@/shared/components/StickyGroupHeader';

export function ActiveBaseplatePanel() {
  const t = useTranslation();
  const { list, activeBaseplateId, switchActive } = useBaseplateLibrary();
  const setShowBaseplateLibrary = useViewStore((s) => s.setShowBaseplateLibrary);
  const summary =
    activeBaseplateId === null
      ? t('baseplate.library.draftName')
      : list.find((ref) => ref.id === activeBaseplateId)?.name;

  const handleChange = useCallback(
    (value: string) => {
      if (value && value !== activeBaseplateId) {
        void switchActive(baseplateDesignId(value));
      }
    },
    [activeBaseplateId, switchActive]
  );

  const manageButton = (
    <IconButton
      size="sm"
      touchTarget={false}
      onClick={() => setShowBaseplateLibrary(true)}
      className="w-7 h-7"
      title={t('baseplate.library.manage')}
      aria-label={t('baseplate.library.manage')}
    >
      <LayoutGridIcon className="w-4 h-4" />
    </IconButton>
  );

  return (
    <StickyGroupHeader
      variant="band"
      title={t('baseplate.title')}
      actions={manageButton}
      summary={summary}
      defaultExpanded={false}
    >
      <PanelSection>
        <Select
          value={activeBaseplateId ?? ''}
          onValueChange={handleChange}
          options={list.map((ref) => ({ id: ref.id, name: ref.name }))}
          placeholder={t('baseplate.library.draftName')}
          aria-label={t('baseplate.library.selectLabel')}
          size="sm"
          fullWidth
          className="text-sm"
        />
      </PanelSection>
    </StickyGroupHeader>
  );
}
