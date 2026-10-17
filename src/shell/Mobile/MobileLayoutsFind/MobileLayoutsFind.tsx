import { Suspense, useState } from 'react';
import { useMobileStore } from '@/core/store/mobile';
import { SearchInput } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';
import { MobileLayoutsPanel } from '../MobileLayoutsPanel';

const PlacesFindList = lazyWithRetry(() =>
  import('@/features/places/components/PlacesFindList').then(namedExport('PlacesFindList'))
);

export function MobileLayoutsFind() {
  const t = useTranslation();
  const enabled = useFeatureFlag('places');
  const closeMobilePanel = useMobileStore((state) => state.closeMobilePanel);
  const [query, setQuery] = useState('');

  if (!enabled) return <MobileLayoutsPanel />;

  return (
    <div>
      <SearchInput
        value={query}
        onValueChange={setQuery}
        clearLabel={t('layouts.clearSearch')}
        placeholder={t('places.find.placeholder')}
        aria-label={t('places.find.label')}
        size="lg"
        fullWidth
        className="pl-2"
        wrapperClassName="mb-3"
      />
      {query.trim() === '' ? (
        <MobileLayoutsPanel />
      ) : (
        <Suspense fallback={null}>
          <PlacesFindList query={query} onDone={closeMobilePanel} />
        </Suspense>
      )}
    </div>
  );
}
