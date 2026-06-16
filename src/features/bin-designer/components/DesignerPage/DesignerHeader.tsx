/**
 * Responsive header/action bar for the bin designer.
 *
 * Desktop: ToolSwitcher + name editing + designs/export buttons | save status + undo/redo + support links
 * Mobile/Tablet: Compact ToolSwitcher + name (tap=list, long-press=rename) | save status + action buttons
 */

import { Button, IconButton } from '@/design-system';
import { ToolSwitcher } from '@/shared/components/ToolSwitcher';
import { HeaderSupportLinks } from '@/shared/components/HeaderSupportLinks';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '@/i18n';
import { SaveStatusIndicator } from './SaveStatusIndicator';
import type { DesignNameEditor } from './useDesignNameEditor';

/** Platform modifier key for keyboard shortcut hints */
const MOD_KEY =
  typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent) ? '\u2318' : 'Ctrl';

interface DesignerHeaderProps {
  isDesktop: boolean;
  nameEditor: DesignNameEditor;
}

export function DesignerHeader({ isDesktop, nameEditor }: DesignerHeaderProps) {
  const t = useTranslation();
  const saveStatus = useDesignerStore((s) => s.saveStatus);
  const designName = useDesignerStore((s) => s.designName);
  const setDesignListOpen = useDesignerStore((s) => s.setDesignListOpen);
  const setExportDialogOpen = useDesignerStore((s) => s.setExportDialogOpen);
  const canExport = useDesignerStore(
    (s) =>
      s.generation.mesh !== null &&
      s.generation.mesh.error === null &&
      s.generation.mesh.vertices !== null &&
      s.generation.mesh.normals !== null
  );
  const { canUndo, canRedo } = useDesignerStore(
    useShallow((s) => ({
      canUndo: s.history.past.length > 0,
      canRedo: s.history.future.length > 0,
    }))
  );
  const undo = useDesignerStore((s) => s.undo);
  const redo = useDesignerStore((s) => s.redo);

  const {
    isEditingName,
    editNameValue,
    nameInputRef,
    setEditNameValue,
    handleNameClick,
    handleNameSubmit,
    handleNameKeyDown,
    handleNameTouchStart,
    handleNameTouchEnd,
    startEditing,
  } = nameEditor;

  return (
    <header className="h-12 flex items-center justify-between px-4 bg-surface-secondary border-b border-stroke-subtle">
      {isDesktop ? (
        /* ---- Desktop action bar ---- */
        <>
          <div className="flex items-center gap-4 min-w-0">
            <ToolSwitcher />

            {/* Design name (click to rename inline) */}
            {isEditingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={handleNameKeyDown}
                maxLength={50}
                aria-label={t('binDesigner.designName')}
                className="px-3 py-1.5 rounded-md text-sm transition-all bg-surface-elevated border border-accent text-content max-w-[200px]"
                style={{
                  boxShadow: '0 0 0 3px var(--color-primary-muted)',
                }}
              />
            ) : (
              <Button
                variant="ghost"
                onClick={handleNameClick}
                className="inline-block px-3 py-1.5 text-sm font-normal rounded-md transition-all hover:scale-[1.02] text-content-secondary bg-transparent hover:bg-surface-hover hover:text-content truncate max-w-[200px]"
                title={t('binDesigner.clickToRename')}
              >
                {designName}
              </Button>
            )}

            {/* Designs switcher button */}
            <Button
              variant="ghost"
              onClick={() => setDesignListOpen(true)}
              className="px-2 py-1.5 text-sm font-normal rounded-md transition-all text-content-secondary bg-transparent hover:bg-surface-hover hover:text-content flex items-center gap-1.5"
              title={t('binDesigner.openDesignList')}
              aria-label={t('binDesigner.openDesignList')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <span className="hidden lg:inline">{t('binDesigner.designs')}</span>
            </Button>

            {/* Export button */}
            <Button
              variant="ghost"
              onClick={() => setExportDialogOpen(true)}
              disabled={!canExport}
              className="px-2 py-1.5 text-sm font-normal rounded-md transition-all text-content-secondary bg-transparent hover:bg-surface-hover hover:text-content flex items-center gap-1.5"
              title={t('binDesigner.exportSTL')}
              aria-label={t('binDesigner.exportBinAsStl')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              <span className="hidden lg:inline">{t('common.export')}</span>
            </Button>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <SaveStatusIndicator status={saveStatus} />

            <div className="flex items-center">
              <IconButton
                variant="ghost"
                touchTarget={false}
                onClick={undo}
                disabled={!canUndo}
                title={`Undo (${MOD_KEY}+Z)`}
                aria-label={`Undo (${MOD_KEY}+Z)`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                  />
                </svg>
              </IconButton>
              <IconButton
                variant="ghost"
                touchTarget={false}
                onClick={redo}
                disabled={!canRedo}
                title={`Redo (${MOD_KEY}+Y)`}
                aria-label={`Redo (${MOD_KEY}+Y)`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
                  />
                </svg>
              </IconButton>
            </div>

            <div className="w-px h-6 bg-stroke-subtle mx-2" />
            <HeaderSupportLinks />
          </div>
        </>
      ) : (
        /* ---- Mobile/Tablet action bar ---- */
        <>
          <ToolSwitcher compact iconOnly />

          {/* Design name - center, tap opens design list, long-press/context-menu renames */}
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={handleNameKeyDown}
              maxLength={50}
              aria-label={t('binDesigner.designName')}
              className="flex-1 mx-3 min-w-0 px-2 py-1 rounded-md text-sm bg-surface-elevated border border-accent text-content"
              style={{
                boxShadow: '0 0 0 3px var(--color-primary-muted)',
              }}
            />
          ) : (
            <Button
              variant="ghost"
              onClick={() => setDesignListOpen(true)}
              onContextMenu={(e) => {
                e.preventDefault();
                startEditing();
              }}
              onTouchStart={handleNameTouchStart}
              onTouchMove={handleNameTouchEnd}
              onTouchEnd={handleNameTouchEnd}
              onTouchCancel={handleNameTouchEnd}
              className="flex-1 mx-3 min-w-0 flex items-center justify-center gap-1 px-2 py-1 text-sm font-normal rounded-md text-content-secondary bg-transparent hover:bg-surface-hover"
              title={t('binDesigner.clickToRename')}
            >
              <span className="truncate">{designName}</span>
              <svg
                className="w-3 h-3 flex-shrink-0 text-content-tertiary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </Button>
          )}

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <SaveStatusIndicator status={saveStatus} compact />

            {/* Designs button */}
            <IconButton
              variant="ghost"
              onClick={() => setDesignListOpen(true)}
              title={t('binDesigner.savedDesigns')}
              aria-label={t('binDesigner.openDesignList')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </IconButton>

            {/* Export button */}
            <IconButton
              variant="ghost"
              onClick={() => setExportDialogOpen(true)}
              disabled={!canExport}
              aria-label={t('binDesigner.exportBinAsStl')}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                />
              </svg>
            </IconButton>

            {/* Undo/Redo */}
            <IconButton
              variant="ghost"
              onClick={undo}
              disabled={!canUndo}
              aria-label={`Undo (${MOD_KEY}+Z)`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
              </svg>
            </IconButton>
            <IconButton
              variant="ghost"
              onClick={redo}
              disabled={!canRedo}
              aria-label={`Redo (${MOD_KEY}+Y)`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
                />
              </svg>
            </IconButton>
          </div>
        </>
      )}
    </header>
  );
}
