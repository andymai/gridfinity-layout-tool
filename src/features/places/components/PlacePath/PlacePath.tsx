import { useLayoutStore, useLibraryStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import { placePath } from '../../utils/placePath';

const SEPARATOR = ' › ';

/** The open layout's place, area and unit, as one line above its name. */
export function PlacePath() {
  const t = useTranslation();
  const library = useLibraryStore((state) => state.library);
  const activeLayoutId = useLayoutStore((state) => state.activeLayoutId);
  const path = placePath(library, activeLayoutId, t('places.myPlace'));
  if (path.length === 0) return null;
  const line = path.join(SEPARATOR);

  return (
    <nav aria-label={t('places.path')} title={line} className="min-w-0 px-3">
      <span className="block truncate text-label text-content-tertiary">{line}</span>
    </nav>
  );
}
