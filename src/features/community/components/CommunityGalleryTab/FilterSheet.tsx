import { useShallow } from 'zustand/react/shallow';
import { Button, Dialog, Select } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useBrowseStore } from '../../store/browseStore';
import { CommunityTechniquePills } from './CommunityTechniquePills';
import { DimensionFilters } from './DimensionFilters';
import { CATEGORY_ALL, categoryOptions, isCommunityCategory } from './galleryFilterOptions';

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
}

export function FilterSheet({ open, onClose }: FilterSheetProps) {
  const t = useTranslation();
  const { category, technique } = useBrowseStore(
    useShallow((s) => ({ category: s.filters.category, technique: s.filters.technique }))
  );
  const setCategory = useBrowseStore((s) => s.setCategory);
  const setTechnique = useBrowseStore((s) => s.setTechnique);
  const setWidthMin = useBrowseStore((s) => s.setWidthMin);
  const setWidthMax = useBrowseStore((s) => s.setWidthMax);
  const setDepthMin = useBrowseStore((s) => s.setDepthMin);
  const setDepthMax = useBrowseStore((s) => s.setDepthMax);
  const setMaxHeight = useBrowseStore((s) => s.setMaxHeight);

  if (!open) return null;

  return (
    <Dialog.Root open onClose={onClose} mobilePresentation="sheet" size="md">
      <Dialog.Header
        title={t('community.gallery.filterSheetTitle')}
        closeAriaLabel={t('common.close')}
      />
      <Dialog.Body>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="community-filter-category"
              className="text-xs font-medium uppercase tracking-wide text-content-tertiary"
            >
              {t('community.gallery.categoryLabel')}
            </label>
            <Select
              id="community-filter-category"
              options={categoryOptions(t)}
              value={category ?? CATEGORY_ALL}
              onValueChange={(value) => {
                setCategory(isCommunityCategory(value) ? value : null);
              }}
              size="lg"
              className="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <div className="text-xs font-medium uppercase tracking-wide text-content-tertiary">
              {t('community.gallery.techniqueLabel')}
            </div>
            <CommunityTechniquePills selected={technique} onChange={setTechnique} touchSize />
          </div>
          <DimensionFilters variant="sheet" />
        </div>
      </Dialog.Body>
      <Dialog.Footer justify="between">
        <Button
          variant="ghost"
          className="min-h-11"
          onClick={() => {
            setCategory(null);
            setTechnique(null);
            setWidthMin(null);
            setWidthMax(null);
            setDepthMin(null);
            setDepthMax(null);
            setMaxHeight(null);
          }}
        >
          {t('community.gallery.clearAll')}
        </Button>
        <Button variant="primary" className="min-h-11" onClick={onClose}>
          {t('common.done')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
