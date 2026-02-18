import { useState, useRef, useEffect } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useHistoryStore, useMobileStore } from '@/core/store';
import { useCollabMode } from '@/hooks/useCollabMode';
import { CONSTRAINTS } from '@/core/constants';
import { PresenceAvatars } from '@/components/Collab';
import type { SaveStatus } from '@/shared/hooks';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { ToolSwitcher } from '@/shared/components/ToolSwitcher';

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
  const setName = useLayoutStore((state) => state.setName);

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
    setName(editValue.trim() || 'Untitled layout');
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
            href="https://ko-fi.com/andyaragon"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              {ICON_PATHS.heart.map((d) => (
                <path key={d} d={d} />
              ))}
            </svg>
            {t('mobile.header.tip')}
          </a>
          <a
            href="https://github.com/andymai/gridfinity-layout-tool"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-content-tertiary hover:underline"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            {t('mobile.header.github')}
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
            <button
              onClick={() => toggleMobilePanel('layouts')}
              onContextMenu={(e) => {
                e.preventDefault();
                handleNameClick();
              }}
              className="w-full text-sm truncate py-1 rounded transition-colors text-content flex items-center justify-center gap-1"
              aria-label={t('mobile.header.openLayoutsPanel')}
            >
              <span className="truncate">{layout.name}</span>
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
            </button>
          )}
        </div>

        {/* Right: Save status + Undo/Redo + Settings */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Presence indicator (only when actually in collaborative mode, inside RoomProvider) */}
          {isCollaborative && <PresenceAvatars />}

          {/* Save status indicator (icon only on mobile) */}
          {saveStatus !== 'idle' && (
            <div
              className="flex items-center justify-center w-7 h-7"
              aria-live="polite"
              aria-label={t('mobile.header.saved')}
            >
              <svg
                className="w-3.5 h-3.5 text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
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
            </div>
          )}
          <button
            onClick={undo}
            disabled={!canUndo}
            className="btn btn-ghost btn-icon"
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
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="btn btn-ghost btn-icon"
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
          </button>
          <button
            onClick={onMenuClick}
            className="btn btn-ghost btn-icon"
            aria-label={t('mobile.header.openSettings')}
            title={t('mobile.settings')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {ICON_PATHS.settings.map((d) => (
                <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
              ))}
            </svg>
          </button>
        </div>
      </header>
    </div>
  );
}
