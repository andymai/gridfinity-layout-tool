import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';

const SPEAKER = 'M4 9v6h4l5 4V5L8 9H4z';
const WAVES = 'M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12';
const MUTE = 'M16 9l5 6M21 9l-5 6';

export function SoundToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const t = useTranslation();
  const label = on ? t('supporters.credits.soundOff') : t('supporters.credits.soundOn');
  return (
    <Button
      variant="ghost"
      iconOnly
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={onToggle}
      className="pointer-events-auto"
      style={{ color: 'inherit' }}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
        <path d={SPEAKER} fill="currentColor" />
        <path
          d={on ? WAVES : MUTE}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
    </Button>
  );
}
