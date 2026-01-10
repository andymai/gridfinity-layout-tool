import { useState, useRef, useEffect } from 'react';
import { useLayoutStore, useHistoryStore, useUIStore } from '../../store';
import { CONSTRAINTS } from '../../constants';
import type { MobilePanel } from '../../store/ui';

interface MobileHeaderProps {
  onMenuClick: () => void;
  onHelpClick: () => void;
}

/**
 * Compact header for mobile layout.
 * Shows app title, tip link, layout name (editable) and essential actions.
 */
export function MobileHeader({ onMenuClick, onHelpClick }: MobileHeaderProps) {
  const layout = useLayoutStore(state => state.layout);
  const setName = useLayoutStore(state => state.setName);

  const canUndo = useHistoryStore(state => state.canUndo);
  const canRedo = useHistoryStore(state => state.canRedo);
  const undo = useHistoryStore(state => state.undo);
  const redo = useHistoryStore(state => state.redo);

  const toggleMobilePanel = useUIStore(state => state.toggleMobilePanel);

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
        <a
          href="https://ko-fi.com/andyaragon"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-accent hover:underline"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          Tip
        </a>
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </button>
        <button
          onClick={() => handleLandscapeNav('inspector')}
          className="landscape-nav-button btn btn-ghost btn-icon"
          aria-label="Inspector"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </button>
        <button
          onClick={() => handleLandscapeNav('categories')}
          className="landscape-nav-button btn btn-ghost btn-icon"
          aria-label="Categories"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </button>
        <button
          onClick={() => handleLandscapeNav('print')}
          className="landscape-nav-button btn btn-ghost btn-icon"
          aria-label="Bin List"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
      </div>

      {/* Center: Layout name */}
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
            onClick={handleNameClick}
            className="w-full text-sm truncate py-1 rounded transition-colors text-content"
          >
            {layout.name}
          </button>
        )}
      </div>

      {/* Right: Undo/Redo + Help */}
      <div className="flex items-center gap-1">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="btn btn-ghost btn-icon"
          aria-label="Undo"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="btn btn-ghost btn-icon"
          aria-label="Redo"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
        </button>
        <button
          onClick={onHelpClick}
          className="btn btn-ghost btn-icon"
          aria-label="Help and gestures"
          title="Help"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    </header>
    </div>
  );
}
