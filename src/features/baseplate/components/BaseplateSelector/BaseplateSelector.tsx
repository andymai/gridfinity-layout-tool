/**
 * There is no Save / Save As here because there is nothing to save:
 * `useBaseplateLibraryInit` guarantees an active design and `useBaseplateAutoSave`
 * keeps it current. New sits in the bar as well as in the library modal, because
 * "Baseplates" reads as a list of saved plates, not as the way to start one.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToastStore } from '@/core/store/toast';
import { useViewStore } from '@/core/store/view';
import { isOk } from '@/core/result';
import { useTranslation } from '@/i18n';
import { Button, Input, Menu, PlusIcon } from '@/design-system';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { useBaseplateLibrary } from '@/features/baseplate/hooks/useBaseplateLibrary';
import { useNewBaseplate } from '@/features/baseplate/hooks/useNewBaseplate';

/** Flat header action, shaped to sit beside Export rather than compete with it. */
const HEADER_ACTION_CLASS =
  'h-8 px-2 text-sm font-normal text-content-secondary hover:text-content';

const MAX_NAME_LENGTH = 64;

export function BaseplateSelector() {
  const t = useTranslation();
  const { list, activeBaseplateId, renameDesign } = useBaseplateLibrary();
  const setShowBaseplateLibrary = useViewStore((s) => s.setShowBaseplateLibrary);
  const addToast = useToastStore((s) => s.addToast);
  const { createBaseplate, creating } = useNewBaseplate();
  // Read through the registry so a rename from the modal shows here immediately.
  const activeName = list.find((ref) => ref.id === activeBaseplateId)?.name ?? '';

  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const startEditing = useCallback(() => {
    setDraftName(activeName);
    setIsEditing(true);
  }, [activeName]);

  const submitName = useCallback(async () => {
    setIsEditing(false);
    const name = draftName.trim();
    // Empty or unchanged is a no-op, not a rename — matches the designer, where
    // clicking the name and clicking away shouldn't do anything.
    if (!activeBaseplateId || !name || name === activeName) return;

    const result = await renameDesign(activeBaseplateId, name);
    if (!isOk(result)) {
      addToast(t('toast.baseplateSaveFailed'), 'error');
    }
  }, [draftName, activeName, activeBaseplateId, renameDesign, addToast, t]);

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="text"
        value={draftName}
        onChange={(e) => setDraftName(e.target.value)}
        onBlur={() => void submitName()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submitName();
          else if (e.key === 'Escape') setIsEditing(false);
        }}
        aria-label={t('baseplate.library.namePrompt')}
        maxLength={MAX_NAME_LENGTH}
        className="h-8 max-w-[200px] text-sm"
      />
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        onClick={startEditing}
        className={`${HEADER_ACTION_CLASS} max-w-[200px] truncate`}
        title={t('baseplate.library.clickToRename')}
      >
        <span className="truncate">{activeName}</span>
      </Button>
      <Button
        variant="ghost"
        onClick={() => setShowBaseplateLibrary(true)}
        className={`${HEADER_ACTION_CLASS} flex items-center gap-1.5`}
        title={t('baseplate.library.openList')}
        aria-label={t('baseplate.library.openList')}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {ICON_PATHS.dashboard.map((d) => (
            <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
          ))}
        </svg>
        <span className="hidden lg:inline">{t('baseplate.library.baseplates')}</span>
      </Button>
      <Button
        variant="ghost"
        onClick={() => void createBaseplate()}
        disabled={creating}
        className={`${HEADER_ACTION_CLASS} flex items-center gap-1.5`}
        title={t('baseplate.library.newBaseplate')}
        aria-label={t('baseplate.library.newBaseplate')}
      >
        <PlusIcon className="h-4 w-4" />
        {/* Below 2xl the label would take the room the plate name needs. */}
        <span className="hidden 2xl:inline">{t('baseplate.library.newBaseplate')}</span>
      </Button>
    </>
  );
}

export function BaseplateMenuItems() {
  const t = useTranslation();
  const setShowBaseplateLibrary = useViewStore((s) => s.setShowBaseplateLibrary);
  const { createBaseplate, creating } = useNewBaseplate();

  return (
    <>
      <Menu.Item onClick={() => setShowBaseplateLibrary(true)}>
        {t('baseplate.library.baseplates')}
      </Menu.Item>
      <Menu.Item onClick={() => void createBaseplate()} disabled={creating}>
        {t('baseplate.library.newBaseplate')}
      </Menu.Item>
    </>
  );
}
