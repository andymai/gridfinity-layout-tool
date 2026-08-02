import { useTranslation } from '@/i18n';

interface DesignListNoResultsProps {
  searchQuery: string;
}

/** Shown inside the list shell when a search matches no saved designs. */
export function DesignListNoResults({ searchQuery }: DesignListNoResultsProps) {
  const t = useTranslation();

  return (
    <div className="text-center py-8 text-content-tertiary">
      <svg
        className="w-10 h-10 mx-auto mb-3 opacity-50"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <p>{t('binDesigner.noDesignsMatch', { query: searchQuery })}</p>
    </div>
  );
}
