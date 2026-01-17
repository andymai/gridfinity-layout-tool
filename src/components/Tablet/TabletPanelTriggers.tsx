interface TabletPanelTriggersProps {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  onOpenLeftPanel: () => void;
  onOpenRightPanel: () => void;
}

/**
 * Floating action buttons (FABs) to open tablet overlay panels.
 * Appear in corners when panels are closed for discoverability.
 */
export function TabletPanelTriggers({
  leftPanelOpen,
  rightPanelOpen,
  onOpenLeftPanel,
  onOpenRightPanel,
}: TabletPanelTriggersProps) {
  return (
    <>
      {/* Left panel trigger - top-left corner */}
      {!leftPanelOpen && (
        <button
          onClick={onOpenLeftPanel}
          className="fixed top-16 left-4 z-30 flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-300 hover:scale-110 active:scale-95"
          style={{
            background: 'var(--color-surface-elevated)',
            border: '1px solid var(--border-default)',
            animation: 'fade-in 0.3s ease-out',
          }}
          aria-label="Open layers panel"
          title="Layers & Categories"
        >
          {/* Layers icon */}
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            style={{ color: 'var(--text-content)' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 5h16M4 12h16m-7 7h7"
            />
          </svg>
        </button>
      )}

      {/* Right panel trigger - top-right corner */}
      {!rightPanelOpen && (
        <button
          onClick={onOpenRightPanel}
          className="fixed top-16 right-4 z-30 flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-300 hover:scale-110 active:scale-95"
          style={{
            background: 'var(--color-surface-elevated)',
            border: '1px solid var(--border-default)',
            animation: 'fade-in 0.3s ease-out',
          }}
          aria-label="Open inspector panel"
          title="Selection & Actions"
        >
          {/* Inspector/settings icon */}
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            style={{ color: 'var(--text-content)' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </button>
      )}
    </>
  );
}
