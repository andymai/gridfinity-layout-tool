import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useFindBins } from '../../hooks/useFindBins';
import { useFocusBin } from '../../hooks/useFocusBin';

const PATH_SEPARATOR = ' › ';

export interface PlacesFindListProps {
  readonly query: string;
  /** Closes the sheet the list sits in; the jump runs after it. */
  readonly onDone: () => void;
}

export function PlacesFindList({ query, onDone }: PlacesFindListProps) {
  const t = useTranslation();
  const { results, indexing } = useFindBins(query);
  const focusBin = useFocusBin();

  if (query.trim() === '') return null;
  if (results.length === 0) {
    return (
      <p role="status" className="py-6 text-center text-sm text-content-tertiary">
        {indexing ? t('places.find.indexing') : t('places.find.noMatch', { query: query.trim() })}
      </p>
    );
  }

  return (
    <ul className="space-y-2 pb-4" aria-label={t('commandPalette.category.bins')}>
      {results.map((result) => (
        <li key={result.key}>
          <Button
            variant="ghost"
            onClick={() => {
              onDone();
              requestAnimationFrame(() => void focusBin(result.layoutId, result.binId));
            }}
            className="h-auto w-full justify-start rounded-lg bg-surface-elevated p-4 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-content">{result.title}</span>
              <span className="block truncate text-xs text-content-tertiary">
                {result.path.join(PATH_SEPARATOR)}
              </span>
            </span>
          </Button>
        </li>
      ))}
    </ul>
  );
}
