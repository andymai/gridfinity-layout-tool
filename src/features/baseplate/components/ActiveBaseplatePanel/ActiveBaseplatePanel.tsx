/**
 * Compact "Baseplate" switcher for the planner sidebar: a Select bound to the
 * global baseplate library plus a manage affordance that opens the library
 * modal.
 *
 * Built on `Collapsible size="md"` with the manage button in `actions` so this
 * slot reads as a peer of Layers and Categories rather than a lone label — the
 * icon button matches their spec exactly, since all three sit in the same
 * column.
 */

import { useCallback } from 'react';
import { useViewStore } from '@/core/store/view';
import { useTranslation } from '@/i18n';
import { Collapsible, IconButton, Select } from '@/design-system';
import { LayoutGridIcon } from '@/design-system/Icon';
import { baseplateDesignId } from '@/core/types';
import { useBaseplateLibrary } from '@/features/baseplate/hooks/useBaseplateLibrary';

export function ActiveBaseplatePanel() {
  const t = useTranslation();
  const { list, activeBaseplateId, switchActive } = useBaseplateLibrary();
  const setShowBaseplateLibrary = useViewStore((s) => s.setShowBaseplateLibrary);

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
    <Collapsible
      title={t('baseplate.title')}
      size="md"
      actions={manageButton}
      defaultExpanded={false}
    >
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
    </Collapsible>
  );
}
