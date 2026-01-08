import { useEffect, type CSSProperties } from 'react';

// Style constants to avoid recreating objects on each render
const STYLES = {
  overlay: { backgroundColor: 'var(--overlay-dark)' } as CSSProperties,
  modal: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-xl)',
    boxShadow: 'var(--shadow-xl)',
  } as CSSProperties,
  title: {
    fontSize: 'var(--text-xl)',
    fontWeight: 'var(--font-bold)',
    color: 'var(--text-primary)',
  } as CSSProperties,
  sectionHeader: {
    fontSize: 'var(--text-base)',
    fontWeight: 'var(--font-semibold)',
    color: 'var(--text-primary)',
  } as CSSProperties,
  sectionContent: {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
  } as CSSProperties,
  textSecondary: { color: 'var(--text-secondary)' } as CSSProperties,
  colorPrimary: { color: 'var(--color-primary)' } as CSSProperties,
  tipsList: {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
  } as CSSProperties,
  gestureIcon: {
    width: 32,
    height: 32,
    color: 'var(--color-accent)',
  } as CSSProperties,
  rowDescription: { fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' } as CSSProperties,
  rowAction: { fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' } as CSSProperties,
} as const;

interface MobileHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Mobile-specific help modal showing touch gestures instead of keyboard shortcuts.
 */
export function MobileHelpModal({ isOpen, onClose }: MobileHelpModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center z-50 animate-fade-in"
      style={STYLES.overlay}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md mx-0 sm:mx-4 max-h-[85vh] overflow-y-auto scrollbar-thin animate-slide-up rounded-t-2xl sm:rounded-2xl"
        style={STYLES.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-help-title"
      >
        {/* Drag handle for bottom sheet feel */}
        <div className="flex justify-center mb-3 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-stroke" />
        </div>

        <div className="flex justify-between items-center mb-5">
          <h2 id="mobile-help-title" style={STYLES.title}>
            Touch Gestures
          </h2>
          <button
            onClick={onClose}
            className="btn btn-ghost w-10 h-10 p-0"
            aria-label="Close help"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          {/* Drawing & Selection */}
          <section>
            <h3 className="mb-3" style={STYLES.sectionHeader}>
              Drawing & Selection
            </h3>
            <div className="space-y-3 p-3 rounded-lg" style={STYLES.sectionContent}>
              <GestureRow
                icon={<TapIcon />}
                gesture="Tap bin"
                description="Select bin"
              />
              <GestureRow
                icon={<DragIcon />}
                gesture="Drag on empty grid"
                description="Draw new bin"
              />
              <GestureRow
                icon={<DragIcon />}
                gesture="Drag selected bin"
                description="Move bin"
              />
              <GestureRow
                icon={<LongPressIcon />}
                gesture="Long-press bin"
                description="Open context menu"
              />
            </div>
          </section>

          {/* Editing */}
          <section>
            <h3 className="mb-3" style={STYLES.sectionHeader}>
              Editing
            </h3>
            <div className="space-y-3 p-3 rounded-lg" style={STYLES.sectionContent}>
              <GestureRow
                icon={<DragEdgeIcon />}
                gesture="Drag bin edge"
                description="Resize bin"
              />
              <GestureRow
                icon={<DragCornerIcon />}
                gesture="Drag corner handle"
                description="Resize width & depth"
              />
              <GestureRow
                icon={<DragIcon />}
                gesture="Drag bin to stash"
                description="Move to staging area"
              />
            </div>
          </section>

          {/* Paint Mode */}
          <section>
            <h3 className="mb-3" style={STYLES.sectionHeader}>
              Paint Mode
            </h3>
            <div className="space-y-3 p-3 rounded-lg" style={STYLES.sectionContent}>
              <GestureRow
                icon={<TapIcon />}
                gesture="Tap size in palette"
                description="Enter paint mode"
              />
              <GestureRow
                icon={<DragIcon />}
                gesture="Drag on grid"
                description="Fill area with bins"
              />
              <GestureRow
                icon={<TapIcon />}
                gesture="Tap × button"
                description="Exit paint mode"
              />
            </div>
          </section>

          {/* Navigation */}
          <section>
            <h3 className="mb-3" style={STYLES.sectionHeader}>
              Navigation
            </h3>
            <div className="space-y-3 p-3 rounded-lg" style={STYLES.sectionContent}>
              <GestureRow
                icon={<SwipeDownIcon />}
                gesture="Swipe down on panel"
                description="Close bottom sheet"
              />
              <GestureRow
                icon={<TapIcon />}
                gesture="Tap layer button"
                description="Switch layers"
              />
              <GestureRow
                icon={<TapIcon />}
                gesture="Tap striped zone"
                description="Jump to blocking bin"
              />
            </div>
          </section>

          {/* Tips */}
          <section>
            <h3 className="mb-3" style={STYLES.sectionHeader}>
              Tips
            </h3>
            <ul className="space-y-2 p-3 rounded-lg" style={STYLES.tipsList}>
              <li className="flex items-start gap-2">
                <span style={STYLES.colorPrimary}>•</span>
                <span>Long-press a bin to duplicate, delete, or move to stash</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={STYLES.colorPrimary}>•</span>
                <span>Tap the 3D cube icon to see your layout in isometric view</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={STYLES.colorPrimary}>•</span>
                <span>Oversized bins are automatically split for printing</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={STYLES.colorPrimary}>•</span>
                <span>Your layout auto-saves to your browser</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function GestureRow({
  icon,
  gesture,
  description,
}: {
  icon: React.ReactNode;
  gesture: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-accent">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div style={STYLES.rowDescription}>{description}</div>
        <div style={STYLES.rowAction}>{gesture}</div>
      </div>
    </div>
  );
}

// Gesture icons
function TapIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4m10-10h-4M6 12H2" />
    </svg>
  );
}

function DragIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
    </svg>
  );
}

function LongPressIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="8" strokeWidth={2} strokeDasharray="4 2" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

function DragEdgeIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="4" y="6" width="12" height="12" rx="1" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12h4m0 0l-2-2m2 2l-2 2" />
    </svg>
  );
}

function DragCornerIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="4" y="4" width="10" height="10" rx="1" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 14l6 6m0 0h-4m4 0v-4" />
    </svg>
  );
}

function SwipeDownIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  );
}
