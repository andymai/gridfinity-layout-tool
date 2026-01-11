import { useState, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useHistoryStore, useUIStore, useLibraryStore } from '../store';
import { useResponsive } from '../hooks';
import { CONSTRAINTS } from '../constants';
import { LayoutManagerModal } from './modals/LayoutManagerModal';

interface HeaderProps {
  onHelpClick: () => void;
}

export function Header({ onHelpClick }: HeaderProps) {
  const { isTablet } = useResponsive();

  const { layout, setName } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      setName: state.setName,
    }))
  );

  const { canUndo, canRedo, undo, redo } = useHistoryStore(
    useShallow((state) => ({
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      undo: state.undo,
      redo: state.redo,
    }))
  );

  const { leftPanelCollapsed, rightPanelCollapsed, toggleLeftPanel, toggleRightPanel } = useUIStore(
    useShallow((state) => ({
      leftPanelCollapsed: state.leftPanelCollapsed,
      rightPanelCollapsed: state.rightPanelCollapsed,
      toggleLeftPanel: state.toggleLeftPanel,
      toggleRightPanel: state.toggleRightPanel,
    }))
  );

  const { showLayoutManager, setShowLayoutManager } = useLibraryStore(
    useShallow((state) => ({
      showLayoutManager: state.showLayoutManager,
      setShowLayoutManager: state.setShowLayoutManager,
    }))
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(layout.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
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


  // Platform detection for keyboard shortcut hints
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <header className="h-12 flex items-center justify-between px-4 bg-surface-secondary border-b border-stroke-subtle">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-content">
          Gridfinity Layout Tool
        </h1>

        {/* Divider */}
        <div className="w-px h-6 bg-stroke-subtle" />

        {/* Layout name */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
            maxLength={CONSTRAINTS.NAME_MAX_LENGTH}
            className="px-3 py-1.5 rounded-md text-sm transition-all bg-surface-elevated border border-accent text-content"
            style={{
              boxShadow: '0 0 0 3px var(--color-primary-muted)'
            }}
          />
        ) : (
          <button
            onClick={handleNameClick}
            className="px-3 py-1.5 text-sm rounded-md transition-all hover:scale-[1.02] text-content-secondary bg-transparent hover:bg-surface-hover hover:text-content"
            title="Click to edit layout name"
          >
            {layout.name}
          </button>
        )}

        {/* Layout Manager Button */}
        <button
          onClick={() => setShowLayoutManager(true)}
          className="px-2 py-1.5 text-sm rounded-md transition-all text-content-secondary bg-transparent hover:bg-surface-hover hover:text-content flex items-center gap-1.5"
          title={`Open layout manager (${modKey}+O)`}
          aria-label="Open layout manager"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="hidden sm:inline">Layouts</span>
        </button>
      </div>

      <div className="flex items-center gap-1">
        {/* Tablet panel toggle buttons */}
        {isTablet && (
          <div className="flex items-center mr-2 border-r border-stroke-subtle pr-2">
            <button
              onClick={toggleLeftPanel}
              className={`btn btn-ghost btn-icon ${!leftPanelCollapsed ? 'bg-surface-hover' : ''}`}
              title="Toggle sidebar panel"
              aria-label="Toggle sidebar panel"
              aria-pressed={!leftPanelCollapsed}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
            <button
              onClick={toggleRightPanel}
              className={`btn btn-ghost btn-icon ${!rightPanelCollapsed ? 'bg-surface-hover' : ''}`}
              title="Toggle inspector panel"
              aria-label="Toggle inspector panel"
              aria-pressed={!rightPanelCollapsed}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </button>
          </div>
        )}

        {/* Undo/Redo buttons */}
        <div className="flex items-center mr-2 border-r border-stroke-subtle pr-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="btn btn-ghost btn-icon"
            title={`Undo last action (${modKey}+Z)`}
            aria-label={`Undo (${modKey}+Z)`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="btn btn-ghost btn-icon"
            title={`Redo last undone action (${modKey}+Y or ${modKey}+Shift+Z)`}
            aria-label={`Redo (${modKey}+Y)`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
          </button>
        </div>

        <button
          onClick={onHelpClick}
          className="btn btn-ghost px-2.5 py-1.5 text-sm text-content-secondary"
          title="Show keyboard shortcuts"
          aria-label="Show help and keyboard shortcuts"
        >
          Press <kbd className="mx-1 px-2 py-1 text-xs font-mono rounded text-content leading-none" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>?</kbd> for help
        </button>
      </div>

      <LayoutManagerModal
        isOpen={showLayoutManager}
        onClose={() => setShowLayoutManager(false)}
      />
    </header>
  );
}
