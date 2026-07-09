import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import type { UserSettings } from '@/core/store/settings';
import { SettingSection } from '../../components/SettingSection/SettingSection';
import { SelectableCard } from '../../components/SelectableCard/SelectableCard';

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

// Fixed palettes so each card previews its own theme regardless of the active one.
const THEME_PALETTES: Record<'light' | 'dark', { bg: string; surface: string; line: string }> = {
  light: { bg: '#f4f4f5', surface: '#ffffff', line: '#d4d4d8' },
  dark: { bg: '#18181b', surface: '#27272a', line: '#3f3f46' },
};

function ThemePreview({ theme }: { theme: ThemeOption }) {
  if (theme === 'system') {
    return (
      <div className="flex h-14 overflow-hidden rounded-md border border-stroke-subtle">
        <div className="flex-1" style={{ backgroundColor: THEME_PALETTES.light.bg }}>
          <MiniWindow palette={THEME_PALETTES.light} />
        </div>
        <div className="flex-1" style={{ backgroundColor: THEME_PALETTES.dark.bg }}>
          <MiniWindow palette={THEME_PALETTES.dark} />
        </div>
      </div>
    );
  }
  const palette = THEME_PALETTES[theme];
  return (
    <div
      className="h-14 overflow-hidden rounded-md border border-stroke-subtle"
      style={{ backgroundColor: palette.bg }}
    >
      <MiniWindow palette={palette} />
    </div>
  );
}

function MiniWindow({ palette }: { palette: { surface: string; line: string } }) {
  return (
    <div className="space-y-1 p-1.5">
      <div className="h-2 rounded-sm" style={{ backgroundColor: palette.surface }} />
      <div className="h-1.5 w-2/3 rounded-sm" style={{ backgroundColor: palette.line }} />
      <div className="h-1.5 w-1/2 rounded-sm" style={{ backgroundColor: palette.line }} />
    </div>
  );
}

function AccentPreview({ hex }: { hex: string }) {
  return (
    <div className="flex h-14 items-center justify-center gap-2 rounded-md border border-stroke-subtle bg-surface">
      <span className="h-6 w-12 rounded-md" style={{ backgroundColor: hex }} />
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: hex }} />
    </div>
  );
}

function DensityPreview({ density }: { density: DensityOption }) {
  const gap = density === 'compact' ? 'gap-0.5' : density === 'comfortable' ? 'gap-2' : 'gap-1';
  const barHeight = density === 'compact' ? 'h-1.5' : density === 'comfortable' ? 'h-3' : 'h-2';
  return (
    <div
      className={`flex h-14 flex-col justify-center rounded-md border border-stroke-subtle bg-surface px-2 ${gap}`}
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className={`${barHeight} rounded-sm bg-stroke`} />
      ))}
    </div>
  );
}

export function AppearanceTab() {
  const t = useTranslation();

  const { theme, accentColor, uiDensity, updateSetting } = useSettingsStore(
    useShallow((state) => ({
      theme: state.settings.theme,
      accentColor: state.settings.accentColor,
      uiDensity: state.settings.uiDensity,
      updateSetting: state.updateSetting,
    }))
  );

  return (
    <div className="space-y-8">
      <SettingSection id="theme" title={t('settings.theme')} resetKeys={['theme']}>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('settings.theme')}>
          {THEME_OPTIONS.map((option) => (
            <SelectableCard
              key={option}
              selected={theme === option}
              onSelect={() => updateSetting('theme', option)}
              label={t(`settings.theme.${option}`)}
              preview={<ThemePreview theme={option} />}
            />
          ))}
        </div>
      </SettingSection>

      <SettingSection id="accent" title={t('settings.accentColor')} resetKeys={['accentColor']}>
        <div
          className="grid grid-cols-3 gap-2"
          role="radiogroup"
          aria-label={t('settings.accentColor')}
        >
          {ACCENT_COLORS.map((color) => (
            <SelectableCard
              key={color.id}
              selected={accentColor === color.id}
              onSelect={() => updateSetting('accentColor', color.id)}
              label={t(`settings.accentColor.${color.id}`)}
              preview={<AccentPreview hex={color.hex} />}
            />
          ))}
        </div>
      </SettingSection>

      <SettingSection id="density" title={t('settings.uiDensity')} resetKeys={['uiDensity']}>
        <div
          className="grid grid-cols-3 gap-2"
          role="radiogroup"
          aria-label={t('settings.uiDensity')}
        >
          {DENSITY_OPTIONS.map((option) => (
            <SelectableCard
              key={option}
              selected={uiDensity === option}
              onSelect={() => updateSetting('uiDensity', option)}
              label={t(`settings.uiDensity.${option}`)}
              preview={<DensityPreview density={option} />}
            />
          ))}
        </div>
      </SettingSection>
    </div>
  );
}
