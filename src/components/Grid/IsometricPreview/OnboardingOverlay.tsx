import { useState, useEffect } from 'react';

const STORAGE_KEY = 'gridfinity-3d-tutorial-seen';

interface OnboardingOverlayProps {
  onDismiss: () => void;
}

/**
 * First-time user tutorial overlay for 3D preview controls.
 * Shows interactive hints and dismisses permanently after acknowledgment.
 */
export function OnboardingOverlay({ onDismiss }: OnboardingOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already seen the tutorial
    const hasSeenTutorial = localStorage.getItem(STORAGE_KEY);

    if (!hasSeenTutorial) {
      // Small delay for smooth appearance
      setTimeout(() => setIsVisible(true), 300);
    } else {
      onDismiss();
    }
  }, [onDismiss]);

  const handleDismiss = () => {
    // Mark tutorial as seen
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);

    // Notify parent after fade-out animation
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only dismiss if clicking the backdrop, not the content
    if (e.target === e.currentTarget) {
      handleDismiss();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-50 animate-fade-in"
      style={{
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={handleBackdropClick}
    >
      <div
        className="relative max-w-md mx-4 p-6 rounded-xl shadow-2xl"
        style={{
          background: 'rgba(20, 20, 30, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-accent/20">
            <svg
              className="w-8 h-8 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            3D Preview Controls
          </h2>
          <p className="text-sm text-content-secondary">
            Learn how to navigate your layout
          </p>
        </div>

        {/* Controls List */}
        <div className="space-y-4 mb-6">
          {/* Desktop Controls */}
          <div className="hidden sm:block space-y-3">
            <ControlItem
              icon="🖱️"
              title="Drag to Rotate"
              description="Click and drag to rotate the view"
            />
            <ControlItem
              icon="🔍"
              title="Scroll to Zoom"
              description="Use mouse wheel to zoom in and out"
            />
            <ControlItem
              icon="⌘"
              title="Cmd/Ctrl + Drag to Pan"
              description="Hold Cmd (Mac) or Ctrl (Windows) while dragging to pan"
            />
          </div>

          {/* Mobile Controls */}
          <div className="block sm:hidden space-y-3">
            <ControlItem
              icon="👆"
              title="Two-Finger Drag to Rotate"
              description="Use two fingers to rotate the view"
            />
            <ControlItem
              icon="🤏"
              title="Pinch to Zoom"
              description="Pinch to zoom in and out"
            />
            <ControlItem
              icon="✋"
              title="Two-Finger Pan"
              description="Drag with two fingers to pan the view"
            />
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 hover:scale-105"
          style={{
            background: '#f59e0b',
            color: 'white',
            border: 'none',
          }}
        >
          Got it!
        </button>

        {/* Small hint */}
        <p className="text-xs text-center text-content-tertiary mt-3">
          Click outside or press this button to dismiss
        </p>
      </div>
    </div>
  );
}

interface ControlItemProps {
  icon: string;
  title: string;
  description: string;
}

function ControlItem({ icon, title, description }: ControlItemProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-elevated/50">
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
        <p className="text-xs text-content-secondary">{description}</p>
      </div>
    </div>
  );
}
