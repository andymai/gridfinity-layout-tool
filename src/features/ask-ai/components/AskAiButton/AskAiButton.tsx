import { useEffect } from 'react';
import { IconButton } from '@/design-system';
import { useTranslation } from '@/i18n';
import { checkAskAiAvailability, useAskAiStore } from '../../store/askAiStore';

/**
 * Opens and closes Ask AI, as an icon: the header has no room for one more
 * label. It shows only once the server says that Ask AI in the app is on.
 */
export function AskAiButton() {
  const t = useTranslation();
  const available = useAskAiStore((s) => s.available);
  const open = useAskAiStore((s) => s.open);
  const toggle = useAskAiStore((s) => s.toggle);

  useEffect(() => {
    void checkAskAiAvailability();
  }, []);

  if (!available) return null;
  return (
    <IconButton
      aria-label={t('askAi.title')}
      title={t('askAi.title')}
      pressed={open}
      aria-controls={open ? 'ask-ai-panel' : undefined}
      onClick={toggle}
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <path d="M8 1.5l1.6 4.2 4.4 1.3-4.4 1.3L8 12.5 6.4 8.3 2 7l4.4-1.3z" />
      </svg>
    </IconButton>
  );
}
