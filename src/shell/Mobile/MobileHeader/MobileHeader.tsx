import { useState, useRef, useEffect, Suspense } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useMobileStore } from '@/core/store';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { useMutations } from '@/shared/contexts';
import { useCollabMode } from '@/shared/hooks/useCollabMode';
import { CONSTRAINTS, DEFAULT_LAYOUT_NAME } from '@/core/constants';
import { GITHUB_REPO_URL, KOFI_URL } from '@/shared/constants/links';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';
import type { SaveStatus } from '@/shared/hooks';
import { Button, IconButton } from '@/design-system';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { ToolSwitcher } from '@/shared/components/ToolSwitcher';

// Lazy: presence avatars pull the Liveblocks client; collab is opt-in.
const PresenceAvatars = lazyWithRetry(() =>
  import('@/shell/Collab/PresenceAvatars').then(namedExport('PresenceAvatars'))
);

interface MobileHeaderProps {
  onMenuClick: () => void;
  saveStatus: SaveStatus;
}

/**
 * Compact header for mobile layout.
 * Shows app title, tip link, layout name (editable) and essential actions.
 */
export function MobileHeader({ onMenuClick, saveStatus }: MobileHeaderProps) {
  const t = useTranslation();
  const layout = useLayoutStore((state) => state.layout);
  const { setName } = useMutations();

  const canUndo = useHistoryStore((state) => state.canUndo);
  const canRedo = useHistoryStore((state) => state.canRedo);
  const undo = useHistoryStore((state) => state.undo);
  const redo = useHistoryStore((state) => state.redo);

  const toggleMobilePanel = useMobileStore((state) => state.toggleMobilePanel);

  // Only show presence avatars when actually in collaborative mode (inside RoomProvider)
  const { isCollaborative } = useCollabMode();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(layout.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleNameClick = () => {
    setEditValue(layout.name);
    setIsEditing(true);
  };

  const handleNameSubmit = () => {
    setName(editValue.trim() || DEFAULT_LAYOUT_NAME);
    setIsEditing(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setEditValue(layout.name);
      setIsEditing(false);
    }
  };

  return (
    <div className="flex-shrink-0">
      {/* App title bar */}
      <div className="h-7 flex items-center justify-between px-3 bg-surface border-b border-stroke-subtle">
        <span className="text-xs font-medium text-content-secondary">
          {t('toolSwitcher.gridfinityLayoutTool')}
        </span>
        <div className="flex items-center gap-3">
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              {ICON_PATHS.heart.map((d) => (
                <path key={d} d={d} />
              ))}
            </svg>
            {t('sidebar.tip')}
          </a>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-content-tertiary hover:underline"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            {t('sidebar.github')}
          </a>
        </div>
      </div>
      {/* Action bar */}
      <header className="mobile-header h-12 flex items-center justify-between px-3 bg-surface-secondary border-b border-stroke-subtle">
        {/* Left: Tool switcher */}
        <ToolSwitcher compact iconOnly />

        {/* Center: Layout name - tap to open layouts panel, long press to edit */}
        <div className="flex-1 mx-3 min-w-0">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={handleNameKeyDown}
              maxLength={CONSTRAINTS.NAME_MAX_LENGTH}
              className="w-full px-2 py-1 rounded text-sm text-center bg-surface-elevated border border-accent text-content"
            />
          ) : (
            <Button
              variant="ghost"
              fullWidth
              onClick={() => toggleMobilePanel('layouts')}
              onContextMenu={(e) => {
                e.preventDefault();
                handleNameClick();
              }}
              className="text-sm px-1 py-1 rounded text-content flex items-center justify-center gap-1 hover:bg-transparent"
              aria-label={t('mobile.header.openLayoutsPanel')}
            >
              <span className="min-w-0 truncate">{layout.name}</span>
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
        </div>

        {/* Right: Save status + Undo/Redo + Settings */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Presence indicator (only when actually in collaborative mode, inside RoomProvider) */}
          {isCollaborative && (
            <Suspense fallback={null}>
              <PresenceAvatars />
            </Suspense>
          )}

          {/* Save status indicator (icon only on mobile) */}
          {saveStatus !== 'idle' && (
            <div
              className="flex items-center justify-center w-7 h-7"
              role="status"
              aria-live="polite"
              aria-label={saveStatus === 'saving' ? t('header.saving') : t('header.saved')}
            >
              {saveStatus === 'saving' ? (
                <svg
                  className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none text-content-tertiary"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-20"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="opacity-70"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-3.5 h-3.5 text-success"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  {ICON_PATHS.check.map((d) => (
                    <path
                      key={d}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d={d}
                    />
                  ))}
                </svg>
              )}
            </div>
          )}
          <IconButton
            onClick={undo}
            disabled={!canUndo}
            aria-label={canUndo ? t('common.undo') : t('mobile.header.nothingToUndo')}
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
            onClick={redo}
            disabled={!canRedo}
            aria-label={canRedo ? t('common.redo') : t('mobile.header.nothingToRedo')}
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
          <IconButton
            onClick={onMenuClick}
            aria-label={t('sidebar.openSettings')}
            title={t('mobile.settings')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {ICON_PATHS.settings.map((d) => (
                <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
              ))}
            </svg>
          </IconButton>
        </div>
      </header>
    </div>
  );
}
