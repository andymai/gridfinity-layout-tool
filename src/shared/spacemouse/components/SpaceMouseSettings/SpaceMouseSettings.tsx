import { Button, SliderInput, Switch } from '@/design-system';
import { useTranslation } from '@/i18n';
import { SENSITIVITY_RANGE, SPEED_RANGE } from '../../constants';
import { isWebHidSupported, requestSpaceMousePairing } from '../../deviceManager';
import {
  useSpaceMouseConnection,
  useSpaceMouseSettings,
  useSpaceMouseStore,
} from '../../settingsStore';
import type { SpaceMouseInvert } from '../../types';

/**
 * Labs sub-panel for SpaceMouse: connection status + pair button, sensitivity
 * and per-family speed sliders, and per-axis invert toggles. Rendered under the
 * feature's card when the flag is on.
 */
export function SpaceMouseSettings(): React.ReactElement {
  const t = useTranslation();
  const settings = useSpaceMouseSettings();
  const { status, deviceName } = useSpaceMouseConnection();
  const setSensitivity = useSpaceMouseStore((s) => s.setSensitivity);
  const setTranslateSpeed = useSpaceMouseStore((s) => s.setTranslateSpeed);
  const setRotateSpeed = useSpaceMouseStore((s) => s.setRotateSpeed);
  const toggleInvert = useSpaceMouseStore((s) => s.toggleInvert);
  const resetSettings = useSpaceMouseStore((s) => s.resetSettings);
  const supported = isWebHidSupported();

  let statusText: string;
  switch (status) {
    case 'connected':
      statusText = t('spacemouse.status.connected', { device: deviceName ?? 'SpaceMouse' });
      break;
    case 'connecting':
      statusText = t('spacemouse.status.connecting');
      break;
    case 'unsupported':
      statusText = t('spacemouse.status.unsupported');
      break;
    case 'error':
      statusText = t('spacemouse.status.error');
      break;
    case 'idle':
      statusText = t('spacemouse.status.idle');
      break;
  }

  const invertRows: Array<{ axis: keyof SpaceMouseInvert; label: string }> = [
    { axis: 'panX', label: t('spacemouse.axis.panX') },
    { axis: 'panY', label: t('spacemouse.axis.panY') },
    { axis: 'zoom', label: t('spacemouse.axis.zoom') },
    { axis: 'orbitH', label: t('spacemouse.axis.orbitH') },
    { axis: 'orbitV', label: t('spacemouse.axis.orbitV') },
  ];

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-stroke-subtle pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-content-secondary">{statusText}</span>
        {supported && status !== 'connecting' && (
          <Button variant="secondary" size="sm" onClick={() => void requestSpaceMousePairing()}>
            {t('spacemouse.connect')}
          </Button>
        )}
      </div>

      <SliderInput
        label={t('spacemouse.sensitivity')}
        value={settings.sensitivity}
        onChange={setSensitivity}
        min={SENSITIVITY_RANGE.min}
        max={SENSITIVITY_RANGE.max}
        step={SENSITIVITY_RANGE.step}
      />
      <SliderInput
        label={t('spacemouse.speed.translate')}
        value={settings.translateSpeed}
        onChange={setTranslateSpeed}
        min={SPEED_RANGE.min}
        max={SPEED_RANGE.max}
        step={SPEED_RANGE.step}
      />
      <SliderInput
        label={t('spacemouse.speed.rotate')}
        value={settings.rotateSpeed}
        onChange={setRotateSpeed}
        min={SPEED_RANGE.min}
        max={SPEED_RANGE.max}
        step={SPEED_RANGE.step}
      />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-content">{t('spacemouse.invertAxes')}</span>
        {invertRows.map((row) => (
          <label key={row.axis} className="flex items-center justify-between gap-2">
            <span className="text-xs text-content-secondary">{row.label}</span>
            <Switch
              checked={settings.invert[row.axis]}
              onChange={() => toggleInvert(row.axis)}
              aria-label={row.label}
            />
          </label>
        ))}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={resetSettings}>
          {t('common.reset')}
        </Button>
      </div>
    </div>
  );
}
