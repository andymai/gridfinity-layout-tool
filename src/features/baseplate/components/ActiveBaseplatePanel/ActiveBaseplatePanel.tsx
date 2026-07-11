/**
 * Compact "Active baseplate" switcher for the planner sidebar.
 *
 * Mirrors the ActiveLayerPanel slot: a Select bound to the global baseplate
 * library plus a "Manage…" affordance that opens the library modal.
 */

import { useCallback } from 'react';
import { useViewStore } from '@/core/store/view';
import { useTranslation } from '@/i18n';
import { Button, Select } from '@/design-system';
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

  return (
    <div className="px-4 py-3">
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-content-tertiary">
        {t('baseplate.library.activeLabel')}
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={activeBaseplateId ?? ''}
          onValueChange={handleChange}
          options={list.map((ref) => ({ id: ref.id, name: ref.name }))}
          placeholder={t('baseplate.library.draftName')}
          aria-label={t('baseplate.library.selectLabel')}
          size="sm"
          className="flex-1 text-sm"
        />
        <Button
          variant="secondary"
          onClick={() => setShowBaseplateLibrary(true)}
          className="shrink-0 px-2.5 py-1.5 text-sm"
        >
          {t('baseplate.library.manage')}
        </Button>
      </div>
    </div>
  );
}
