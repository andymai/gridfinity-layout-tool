/**
 * Active-design selector cluster for the /baseplate page header.
 *
 * A dropdown of saved baseplate designs plus New / Save (or Save As) / Manage.
 * - New starts a fresh unsaved draft (pointer null, default params).
 * - Save on a draft prompts a name, persists it to the library, and points the
 *   layout at the new design. When a design is already active, autosave keeps it
 *   in sync so the action switches to "Save As" (fork).
 * - Manage opens the baseplate library modal via the view store flag.
 */

import { useCallback, useRef, useState } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useViewStore } from '@/core/store/view';
import { useMutations } from '@/shared/contexts';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { baseplateDesignId } from '@/core/types';
import { isOk } from '@/core/result';
import { useTranslation } from '@/i18n';
import { Button, Input, Select } from '@/design-system';
import type { BaseplateRef } from '@/features/baseplate/store/baseplateRegistry';
import { useBaseplateLibrary } from '@/features/baseplate/hooks/useBaseplateLibrary';

/** Next free "Baseplate N" name given the current library entries. */
function nextBaseplateName(list: readonly BaseplateRef[]): string {
  const used = new Set(
    list
      .map((ref) => /^Baseplate (\d+)$/.exec(ref.name)?.[1])
      .filter((match): match is string => match !== undefined)
      .map((n) => Number.parseInt(n, 10))
  );
  let n = 1;
  while (used.has(n)) n += 1;
  return `Baseplate ${n}`;
}

export function BaseplateSelector() {
  const t = useTranslation();
  const { list, activeBaseplateId, switchActive, saveCurrentAsNew, forkActive } =
    useBaseplateLibrary();
  const baseplateParams = useLayoutStore((s) => s.layout.baseplateParams);
  const setShowBaseplateLibrary = useViewStore((s) => s.setShowBaseplateLibrary);
  const mutations = useMutations();

  const [isNaming, setIsNaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isDraft = activeBaseplateId === null;

  const handleSwitch = useCallback(
    (value: string) => {
      if (value && value !== activeBaseplateId) {
        void switchActive(baseplateDesignId(value));
      }
    },
    [activeBaseplateId, switchActive]
  );

  const handleNew = useCallback(() => {
    mutations.setActiveBaseplate(null, { ...DEFAULT_BASEPLATE_PARAMS });
  }, [mutations]);

  const startNaming = useCallback(() => {
    setDraftName(nextBaseplateName(list));
    setIsNaming(true);
    requestAnimationFrame(() => nameInputRef.current?.select());
  }, [list]);

  const cancelNaming = useCallback(() => {
    setIsNaming(false);
    setDraftName('');
  }, []);

  const confirmNaming = useCallback(async () => {
    const name = draftName.trim();
    if (!name || !baseplateParams) {
      cancelNaming();
      return;
    }
    const result = await saveCurrentAsNew(name, baseplateParams);
    if (isOk(result)) {
      mutations.setActiveBaseplate(result.value.id, result.value.params);
    }
    cancelNaming();
  }, [draftName, baseplateParams, saveCurrentAsNew, mutations, cancelNaming]);

  const handleFork = useCallback(() => {
    forkActive();
  }, [forkActive]);

  if (isNaming) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          ref={nameInputRef}
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void confirmNaming();
            else if (e.key === 'Escape') cancelNaming();
          }}
          placeholder={t('baseplate.library.namePlaceholder')}
          aria-label={t('baseplate.library.namePrompt')}
          maxLength={64}
          className="h-8 text-sm"
        />
        <Button
          variant="primary"
          onClick={() => void confirmNaming()}
          className="px-2.5 py-1.5 text-sm"
        >
          {t('common.save')}
        </Button>
        <Button variant="ghost" onClick={cancelNaming} className="px-2.5 py-1.5 text-sm">
          {t('common.cancel')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={activeBaseplateId ?? ''}
        onValueChange={handleSwitch}
        options={list.map((ref) => ({ id: ref.id, name: ref.name }))}
        placeholder={t('baseplate.library.draftName')}
        aria-label={t('baseplate.library.selectLabel')}
        size="sm"
        className="min-w-40 text-sm"
      />
      <Button variant="secondary" onClick={handleNew} className="px-2.5 py-1.5 text-sm">
        {t('baseplate.library.new')}
      </Button>
      {isDraft ? (
        <Button variant="primary" onClick={startNaming} className="px-2.5 py-1.5 text-sm">
          {t('common.save')}
        </Button>
      ) : (
        <Button variant="secondary" onClick={handleFork} className="px-2.5 py-1.5 text-sm">
          {t('baseplate.library.saveAs')}
        </Button>
      )}
      <Button
        variant="ghost"
        onClick={() => setShowBaseplateLibrary(true)}
        className="px-2.5 py-1.5 text-sm"
      >
        {t('baseplate.library.manage')}
      </Button>
    </div>
  );
}
