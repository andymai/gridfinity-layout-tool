/**
 * Compact "Baseplate" switcher for the planner sidebar: a Select bound to the
 * global baseplate library plus a "Manage…" affordance that opens the library
 * modal.
 *
 * Built on `Collapsible size="md"` with the manage button in `actions` so this
 * slot reads as a peer of Layers and Categories rather than a lone label.
 */

import { useCallback } from 'react';
import { useViewStore } from '@/core/store/view';
import { useTranslation } from '@/i18n';
import { Button, Collapsible, Select } from '@/design-system';
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
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setShowBaseplateLibrary(true)}
      className="text-xs text-content-tertiary hover:text-content"
    >
      {t('baseplate.library.manage')}
    </Button>
  );

  return (
    <Collapsible title={t('baseplate.title')} size="md" actions={manageButton}>
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
