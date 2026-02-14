import { useShallow } from 'zustand/shallow';
import { useSettingsStore } from '@/core/store';
import { Checkbox } from '@/shared/components/Checkbox';
import { useTranslation } from '@/i18n';
import type { UserSettings } from '@/core/store/settings';

type ThemeOption = UserSettings['theme'];
type AccentOption = UserSettings['accentColor'];
type DensityOption = UserSettings['uiDensity'];

const THEME_OPTIONS: ThemeOption[] = ['dark', 'light', 'system'];

const ACCENT_COLORS: { id: AccentOption; hex: string }[] = [
  { id: 'amber', hex: '#f59e0b' },
  { id: 'rose', hex: '#f43f5e' },
  { id: 'fuchsia', hex: '#d946ef' },
  { id: 'emerald', hex: '#10b981' },
  { id: 'sky', hex: '#0ea5e9' },
  { id: 'violet', hex: '#7c3aed' },
];

const DENSITY_OPTIONS: DensityOption[] = ['compact', 'default', 'comfortable'];

function RadioItem({
  selected,
  label,
  onSelect,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between text-sm cursor-pointer rounded-md p-2 -m-1 outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        selected ? 'bg-surface-elevated border border-accent/30' : 'hover:bg-surface-hover'
      }`}
      onClick={onSelect}
      role="radio"
      tabIndex={0}
      aria-checked={selected}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <span className={selected ? 'text-content' : 'text-content-secondary'}>{label}</span>
      {selected && (
        <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );
}

function ToggleRow({
  checked,
  label,
  hint,
  disabled = false,
  onToggle,
}: {
  checked: boolean;
  label: string;
  hint?: string;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between text-sm group rounded-md p-1 -m-1 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface ${
        disabled ? 'opacity-40 cursor-default' : 'cursor-pointer'
      }`}
      onClick={disabled ? undefined : onToggle}
      role="checkbox"
      tabIndex={disabled ? -1 : 0}
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div>
        <span
          className={`${checked ? 'text-content' : 'text-content-tertiary'} ${disabled ? '' : 'group-hover:text-content'} transition-colors`}
        >
          {label}
        </span>
        {hint && <p className="text-xs text-content-disabled mt-0.5">{hint}</p>}
      </div>
      <Checkbox checked={checked} variant="desktop" />
    </div>
  );
}

export function AppearanceTab() {
  const t = useTranslation();

  const {
    theme,
    accentColor,
    uiDensity,
    gridShowLines,
    gridShowHalfLines,
    gridLineOpacity,
    reduceMotion,
    updateSetting,
  } = useSettingsStore(
    useShallow((state) => ({
      theme: state.settings.theme,
      accentColor: state.settings.accentColor,
      uiDensity: state.settings.uiDensity,
      gridShowLines: state.settings.gridShowLines,
      gridShowHalfLines: state.settings.gridShowHalfLines,
      gridLineOpacity: state.settings.gridLineOpacity,
      reduceMotion: state.settings.reduceMotion,
      updateSetting: state.updateSetting,
    }))
  );

  return (
    <div className="space-y-8">
      {/* Theme */}
      <section>
        <h3 className="text-base font-semibold text-content mb-3">{t('settings.theme')}</h3>
        <div className="space-y-1" role="radiogroup" aria-label={t('settings.theme')}>
          {THEME_OPTIONS.map((option) => (
            <RadioItem
              key={option}
              selected={theme === option}
              label={t(`settings.theme.${option}`)}
              onSelect={() => updateSetting('theme', option)}
            />
          ))}
        </div>
      </section>

      {/* Accent Color */}
      <section>
        <h3 className="text-base font-semibold text-content mb-3">{t('settings.accentColor')}</h3>
        <div
          className="grid grid-cols-3 gap-2"
          role="radiogroup"
          aria-label={t('settings.accentColor')}
        >
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.id}
              onClick={() => updateSetting('accentColor', color.id)}
              role="radio"
              aria-checked={accentColor === color.id}
              aria-label={t(`settings.accentColor.${color.id}`)}
              className={`flex items-center gap-2 p-2 rounded-md border transition-colors text-left ${
                accentColor === color.id
                  ? 'border-accent bg-surface-elevated'
                  : 'border-stroke-subtle hover:bg-surface-hover'
              }`}
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: color.hex }}
              />
              <span className="text-sm text-content-secondary truncate">
                {t(`settings.accentColor.${color.id}`)}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* UI Density */}
      <section>
        <h3 className="text-base font-semibold text-content mb-3">{t('settings.uiDensity')}</h3>
        <div className="space-y-1" role="radiogroup" aria-label={t('settings.uiDensity')}>
          {DENSITY_OPTIONS.map((option) => (
            <RadioItem
              key={option}
              selected={uiDensity === option}
              label={t(`settings.uiDensity.${option}`)}
              onSelect={() => updateSetting('uiDensity', option)}
            />
          ))}
        </div>
      </section>

      {/* Grid Visuals */}
      <section>
        <h3 className="text-base font-semibold text-content mb-3">{t('settings.gridVisuals')}</h3>
        <div className="space-y-3">
          <ToggleRow
            checked={gridShowLines}
            label={t('settings.gridShowLines')}
            onToggle={() => updateSetting('gridShowLines', !gridShowLines)}
          />
          <ToggleRow
            checked={gridShowHalfLines}
            label={t('settings.gridShowHalfLines')}
            disabled={!gridShowLines}
            onToggle={() => updateSetting('gridShowHalfLines', !gridShowHalfLines)}
          />
          <div className={gridShowLines ? '' : 'opacity-40'}>
            <label htmlFor="grid-opacity" className="text-sm text-content mb-1 block">
              {t('settings.gridLineOpacity')}: {gridLineOpacity}%
            </label>
            <input
              id="grid-opacity"
              type="range"
              min={0}
              max={100}
              step={5}
              value={gridLineOpacity}
              disabled={!gridShowLines}
              onChange={(e) => updateSetting('gridLineOpacity', Number(e.target.value))}
              className="w-full accent-accent"
            />
          </div>
        </div>
      </section>

      {/* Reduce Motion */}
      <section>
        <ToggleRow
          checked={reduceMotion}
          label={t('settings.reduceMotion')}
          hint={t('settings.reduceMotionHint')}
          onToggle={() => updateSetting('reduceMotion', !reduceMotion)}
        />
      </section>
    </div>
  );
}
