import { Command } from 'cmdk';
import { useTranslation } from '@/i18n';
import { PRE_RANKED_VALUE_PREFIX } from '@/shared/utils/commandPaletteFilter';
import { useFindBins } from '../../hooks/useFindBins';
import { useFocusBin } from '../../hooks/useFocusBin';

const PATH_SEPARATOR = ' › ';

export interface PlacesFindGroupProps {
  readonly query: string;
  /** Closes the palette; the jump runs after it, so focus lands on the grid. */
  readonly onDone: () => void;
}

/**
 * Bin results for the command palette, rendered inside its `Command`. The
 * matching and ranking are ours, so each value carries the pre-ranked prefix
 * the palette's filter keeps in order above commands. Nothing here may be
 * force-mounted: cmdk only counts items that register, a forced one never
 * does, and "No results" would stay up.
 */
export function PlacesFindGroup({ query, onDone }: PlacesFindGroupProps) {
  const t = useTranslation();
  const { results, indexing } = useFindBins(query);
  const focusBin = useFocusBin();

  if (query.trim() === '') return null;
  if (results.length === 0) {
    return indexing ? (
      <Command.Loading>
        <p className="mx-2 px-2.5 py-2 text-label text-content-tertiary">
          {t('places.find.indexing')}
        </p>
      </Command.Loading>
    ) : null;
  }

  return (
    <Command.Group
      className="mb-0.5"
      heading={
        <div className="px-3 pb-1.5 pt-1">
          <span className="text-micro font-semibold text-content-tertiary uppercase tracking-wider">
            {t('commandPalette.category.bins')}
          </span>
        </div>
      }
    >
      {results.map((result) => (
        <Command.Item
          key={result.key}
          value={`${PRE_RANKED_VALUE_PREFIX}${result.key}`}
          onSelect={() => {
            onDone();
            requestAnimationFrame(() => void focusBin(result.layoutId, result.binId));
          }}
          className="flex flex-col items-start gap-0.5 mx-2 px-2.5 py-2 rounded-lg cursor-pointer text-body text-content transition-colors data-[selected=true]:bg-accent/10 data-[selected=true]:text-accent focus-visible:outline-none"
        >
          <span className="truncate max-w-full">{result.title}</span>
          <span className="truncate max-w-full text-label text-content-tertiary">
            {result.path.join(PATH_SEPARATOR)}
          </span>
        </Command.Item>
      ))}
    </Command.Group>
  );
}
