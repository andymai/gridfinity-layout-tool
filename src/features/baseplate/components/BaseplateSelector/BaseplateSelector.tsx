/**
 * Active-design selector cluster for the /baseplate page header.
 *
 * A dropdown of saved baseplate designs plus New / Save (or Save As) / Manage.
 *
 * Header vocabulary: the Select is the only bordered control (it's an input);
 * every action beside it is a flat ghost button, matching Export and the
 * DesignerHeader cluster next door. The one filled button is the confirm inside
 * the naming form — a form submit, not a resting header action, and it can't
 * collide with the Ko-fi CTA because the cluster is replaced while naming.
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

/** Flat header action, shaped to sit beside Export rather than compete with it. */
const HEADER_ACTION_CLASS =
  'h-8 px-2 text-sm font-normal text-content-secondary hover:text-content';

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
          className="h-8 px-2.5 text-sm"
        >
          {t('common.save')}
        </Button>
        <Button variant="ghost" onClick={cancelNaming} className={HEADER_ACTION_CLASS}>
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
      <Button variant="ghost" onClick={handleNew} className={HEADER_ACTION_CLASS}>
        {t('baseplate.library.new')}
      </Button>
      {isDraft ? (
        <Button variant="ghost" onClick={startNaming} className={HEADER_ACTION_CLASS}>
          {t('common.save')}
        </Button>
      ) : (
        <Button variant="ghost" onClick={handleFork} className={HEADER_ACTION_CLASS}>
          {t('baseplate.library.saveAs')}
        </Button>
      )}
      <Button
        variant="ghost"
        onClick={() => setShowBaseplateLibrary(true)}
        className={HEADER_ACTION_CLASS}
      >
        {t('baseplate.library.manage')}
      </Button>
    </div>
  );
}
