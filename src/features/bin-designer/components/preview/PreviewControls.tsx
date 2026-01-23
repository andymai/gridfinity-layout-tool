/**
 * Overlay control buttons for the 3D preview.
 * Camera presets, reset view, and wireframe toggle.
 */

export type CameraPreset = 'front' | 'side' | 'top' | 'isometric';

interface PreviewControlsProps {
  wireframe: boolean;
  highContrast: boolean;
  onWireframeToggle: () => void;
  onHighContrastToggle: () => void;
  onCameraPreset: (preset: CameraPreset) => void;
  onResetView: () => void;
}

const PRESETS: Array<{ key: CameraPreset; label: string; shortcut: string }> = [
  { key: 'front', label: 'Front', shortcut: '1' },
  { key: 'side', label: 'Side', shortcut: '2' },
  { key: 'top', label: 'Top', shortcut: '3' },
  { key: 'isometric', label: 'Iso', shortcut: '4' },
];

export function PreviewControls({
  wireframe,
  highContrast,
  onWireframeToggle,
  onHighContrastToggle,
  onCameraPreset,
  onResetView,
}: PreviewControlsProps) {
  // Shared button styles — min 36px touch target (44px on touch devices via padding)
  const baseBtn = "rounded-md bg-surface-elevated/80 px-2.5 py-1.5 text-[11px] font-medium text-content-secondary shadow-sm backdrop-blur transition-colors hover:bg-surface-elevated hover:text-content min-w-[36px] min-h-[32px] md:min-h-[28px] touch-manipulation";

  return (
    <div className="absolute right-2 top-2 flex flex-col gap-1.5">
      {/* Camera presets */}
      {PRESETS.map(({ key, label, shortcut }) => (
        <button
          key={key}
          type="button"
          onClick={() => onCameraPreset(key)}
          className={baseBtn}
          title={`${label} view (${shortcut})`}
          aria-label={`${label} camera view`}
        >
          {label}
        </button>
      ))}

      <div className="my-0.5 h-px bg-stroke-subtle/50" />

      {/* Reset view */}
      <button
        type="button"
        onClick={onResetView}
        className={baseBtn}
        title="Reset view (R)"
        aria-label="Reset camera view"
      >
        Reset
      </button>

      {/* Wireframe toggle */}
      <button
        type="button"
        onClick={onWireframeToggle}
        className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur transition-colors min-w-[36px] min-h-[32px] md:min-h-[28px] touch-manipulation ${
          wireframe
            ? 'bg-accent text-white'
            : 'bg-surface-elevated/80 text-content-secondary hover:bg-surface-elevated hover:text-content'
        }`}
        title="Toggle wireframe (W)"
        aria-label="Toggle wireframe mode"
        aria-pressed={wireframe}
      >
        Wire
      </button>

      {/* High contrast toggle */}
      <button
        type="button"
        onClick={onHighContrastToggle}
        className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur transition-colors min-w-[36px] min-h-[32px] md:min-h-[28px] touch-manipulation ${
          highContrast
            ? 'bg-yellow-500 text-black'
            : 'bg-surface-elevated/80 text-content-secondary hover:bg-surface-elevated hover:text-content'
        }`}
        title="Toggle high contrast"
        aria-label="Toggle high contrast preview"
        aria-pressed={highContrast}
      >
        HC
      </button>
    </div>
  );
}
