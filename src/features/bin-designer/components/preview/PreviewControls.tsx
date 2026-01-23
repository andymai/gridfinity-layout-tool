/**
 * Overlay control buttons for the 3D preview.
 * Camera presets, reset view, and wireframe toggle.
 */

export type CameraPreset = 'front' | 'side' | 'top' | 'isometric';

interface PreviewControlsProps {
  wireframe: boolean;
  onWireframeToggle: () => void;
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
  onWireframeToggle,
  onCameraPreset,
  onResetView,
}: PreviewControlsProps) {
  return (
    <div className="absolute right-2 top-2 flex flex-col gap-1">
      {/* Camera presets */}
      {PRESETS.map(({ key, label, shortcut }) => (
        <button
          key={key}
          type="button"
          onClick={() => onCameraPreset(key)}
          className="rounded bg-white/80 px-2 py-1 text-[10px] font-medium text-gray-700 shadow-sm backdrop-blur hover:bg-white"
          title={`${label} view (${shortcut})`}
          aria-label={`${label} camera view`}
        >
          {label}
        </button>
      ))}

      <div className="my-1 h-px bg-gray-300" />

      {/* Reset view */}
      <button
        type="button"
        onClick={onResetView}
        className="rounded bg-white/80 px-2 py-1 text-[10px] font-medium text-gray-700 shadow-sm backdrop-blur hover:bg-white"
        title="Reset view (R)"
        aria-label="Reset camera view"
      >
        Reset
      </button>

      {/* Wireframe toggle */}
      <button
        type="button"
        onClick={onWireframeToggle}
        className={`rounded px-2 py-1 text-[10px] font-medium shadow-sm backdrop-blur ${
          wireframe
            ? 'bg-accent text-white'
            : 'bg-white/80 text-gray-700 hover:bg-white'
        }`}
        title="Toggle wireframe (W)"
        aria-label="Toggle wireframe mode"
        aria-pressed={wireframe}
      >
        Wire
      </button>
    </div>
  );
}
