/**
 * Read-only info block for a mesh imprint cutout's imported source: file
 * name, triangle count, and physical size. The footprint is derived from the
 * mesh, so there are no shape parameters to edit here — depth/fit/transform
 * live in their usual sections.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';

interface MeshCutoutInfoProps {
  readonly cutout: Cutout;
}

export function MeshCutoutInfo({ cutout }: MeshCutoutInfoProps) {
  const t = useTranslation();
  const asset = useDesignerStore((s) =>
    cutout.meshId !== undefined ? s.params.meshAssets?.[cutout.meshId] : undefined
  );
  if (!asset) return null;

  const { sizeMm } = asset;
  return (
    <div className="rounded border border-stroke-subtle bg-surface-sunken px-2 py-1.5 text-xs text-content-secondary">
      <div className="truncate font-medium text-content" title={asset.name}>
        {asset.name}
      </div>
      <div>
        {`${sizeMm.x.toFixed(1)} × ${sizeMm.y.toFixed(1)} × ${sizeMm.z.toFixed(1)} mm`}
        {' · '}
        {t('binDesigner.cutouts.stlImport.triangles', { count: asset.triangleCount })}
      </div>
    </div>
  );
}
