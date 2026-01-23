import { useState, useRef, useEffect } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useHistoryStore, useUIStore } from '@/core/store';
import { useCollabMode } from '@/hooks/useCollabMode';
import { CONSTRAINTS } from '@/core/constants';
import { PresenceAvatars } from '@/components/Collab';
import type { MobilePanel } from '@/core/store/ui';
import type { SaveStatus } from '@/shared/hooks';

interface MobileHeaderProps {
  onMenuClick: () => void;
  onHelpClick: () => void;
  saveStatus: SaveStatus;
}

/**
 * Compact header for mobile layout.
 * Shows app title, tip link, layout name (editable) and essential actions.
 */
export function MobileHeader({ onMenuClick, onHelpClick, saveStatus }: MobileHeaderProps) {
  const layout = useLayoutStore((state) => state.layout);
  const setName = useLayoutStore((state) => state.setName);

  const canUndo = useHistoryStore((state) => state.canUndo);
  const canRedo = useHistoryStore((state) => state.canRedo);
  const undo = useHistoryStore((state) => state.undo);
  const redo = useHistoryStore((state) => state.redo);

  const toggleMobilePanel = useUIStore((state) => state.toggleMobilePanel);

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

  // Helper for landscape nav buttons
  const handleLandscapeNav = (panel: MobilePanel) => {
    toggleMobilePanel(panel);
  };

  return (
    <div className="flex-shrink-0">
      {/* App title bar */}
      <div className="h-7 flex items-center justify-between px-3 bg-surface border-b border-stroke-subtle">
        <span className="text-xs font-medium text-content-secondary">Gridfinity Layout Tool</span>
        <div className="flex items-center gap-3">
          <a
            href="https://www.reddit.com/r/gridfinity/comments/1q93nz6/i_built_a_free_layout_planner_for_gridfinity/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-accent hover:underline"
            aria-label="Discuss on Reddit"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
            </svg>
            Reddit
          </a>
          <a
            href="https://ko-fi.com/andyaragon"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            Tip
          </a>
        </div>
      </div>
      {/* Action bar */}
      <header className="mobile-header h-12 flex items-center justify-between px-3 bg-surface-secondary border-b border-stroke-subtle">
        {/* Left: Settings button */}
        <button
          onClick={onMenuClick}
          className="btn btn-ghost btn-icon"
          aria-label="Open settings"
          title="Settings"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>

        {/* Landscape nav buttons (shown when bottom nav is hidden) */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleLandscapeNav('layers')}
            className="landscape-nav-button btn btn-ghost btn-icon"
            aria-label="Layers"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </button>
          <button
            onClick={() => handleLandscapeNav('inspector')}
            className="landscape-nav-button btn btn-ghost btn-icon"
            aria-label="Inspector"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </button>
          <button
            onClick={() => handleLandscapeNav('categories')}
            className="landscape-nav-button btn btn-ghost btn-icon"
            aria-label="Categories"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
          </button>
          <button
            onClick={() => handleLandscapeNav('print')}
            className="landscape-nav-button btn btn-ghost btn-icon"
            aria-label="Bin List"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </button>
        </div>

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
              aria-label="Open layouts panel"
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

        {/* Right: Presence + Save status + Undo/Redo + Help */}
        <div className="flex items-center gap-1">
          {/* Presence indicator (only when actually in collaborative mode, inside RoomProvider) */}
          {isCollaborative && <PresenceAvatars />}

          {/* Save status indicator (icon only on mobile) */}
          {saveStatus !== 'idle' && (
            <div
              className="flex items-center justify-center w-7 h-7"
              aria-live="polite"
              aria-label="Saved"
            >
              <svg
                className="w-3.5 h-3.5 text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}
          <button
            onClick={undo}
            disabled={!canUndo}
            className="btn btn-ghost btn-icon"
            aria-label={canUndo ? 'Undo' : 'Nothing to undo'}
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
            aria-label={canRedo ? 'Redo' : 'Nothing to redo'}
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
            onClick={onHelpClick}
            className="btn btn-ghost btn-icon"
            aria-label="Help and gestures"
            title="Help"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        </div>
      </header>
    </div>
  );
}
