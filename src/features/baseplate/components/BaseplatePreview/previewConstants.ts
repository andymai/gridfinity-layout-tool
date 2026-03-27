import type { SplitViewMode } from '../../store/baseplatePageStore';
import type { CameraPreset } from './cameraUtils';
import { IconAssembled, IconExploded, IconFront, IconSide, IconTop, IconIso } from './previewIcons';

export const VIEW_MODE_ICONS: Record<SplitViewMode, () => React.ReactNode> = {
  assembled: IconAssembled,
  exploded: IconExploded,
};

export const PRESET_ICONS: Record<CameraPreset, () => React.ReactNode> = {
  front: IconFront,
  side: IconSide,
  top: IconTop,
  isometric: IconIso,
};

export const PRESETS: Array<{ key: CameraPreset; labelKey: string }> = [
  { key: 'front', labelKey: 'baseplate.frontView' },
  { key: 'side', labelKey: 'baseplate.sideView' },
  { key: 'top', labelKey: 'baseplate.topView' },
  { key: 'isometric', labelKey: 'baseplate.isoView' },
];
