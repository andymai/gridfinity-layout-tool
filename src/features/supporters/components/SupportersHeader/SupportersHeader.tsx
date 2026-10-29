import { Button, Input } from '@/design-system';
import { useTranslation } from '@/i18n';
import { NO_SCRUB_ATTR } from '../../hooks/useRollScrub';

interface SupportersHeaderProps {
  query: string;
  onQueryChange: (query: string) => void;
  onFind: () => void;
  /** Result of the last search, shown under the field. */
  status: string | null;
  onBack: () => void;
}

export function SupportersHeader({
  query,
  onQueryChange,
  onFind,
  status,
  onBack,
}: SupportersHeaderProps) {
  const t = useTranslation();
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-5">
      <Button
        variant="ghost"
        onClick={onBack}
        className="pointer-events-auto flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 text-sm"
        style={{ color: 'inherit' }}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('supporters.back')}
      </Button>
      <div className="flex flex-col items-end gap-2" {...{ [NO_SCRUB_ATTR]: '' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onFind();
          }}
          className="pointer-events-auto flex items-center gap-2"
        >
          <div className="w-28 sm:w-44">
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={t('supporters.find.placeholder')}
              aria-label={t('supporters.find.placeholder')}
              size="sm"
              fullWidth
            />
          </div>
          <Button type="submit" variant="secondary" className="px-3 py-1.5 text-sm">
            {t('supporters.find.submit')}
          </Button>
        </form>
        {status && (
          <p
            className="pointer-events-none max-w-[16rem] rounded-md bg-black/55 px-2.5 py-1 text-right text-xs text-white/90 backdrop-blur-sm"
            role="status"
          >
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
