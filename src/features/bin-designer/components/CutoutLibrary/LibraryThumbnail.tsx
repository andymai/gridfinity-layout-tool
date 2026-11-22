/**
 * An item's picture: the 3D render once this device has made it, and its
 * outline drawn flat until then, so a row is never blank.
 */

import { useEffect, useMemo, useState } from 'react';
import type { CutoutLibraryItem } from '@/features/bin-designer/library/libraryTypes';
import { getCutoutOutline } from '../panel/CutoutsSection/cutoutOutline';
import { contentBounds } from './libraryContent';
import { useLatestRef } from '@/shared/hooks/useLatestRef';
import { requestThumbnail } from './thumbnailQueue';

interface LibraryThumbnailProps {
  readonly item: CutoutLibraryItem;
  /** Side of the square it fills, in pixels. */
  readonly size: number;
}

function LibraryOutline({ item, size }: LibraryThumbnailProps) {
  const { params } = item.content;
  const drawing = useMemo(() => {
    const box = contentBounds(params.cutouts);
    if (!box) return null;
    const span = Math.max(box.maxX - box.minX, box.maxY - box.minY, 1);
    const pad = span * 0.08;
    const d = params.cutouts
      .flatMap((c) => getCutoutOutline(c, params.meshAssets) ?? [])
      .map(
        (ring) =>
          `M${ring.map((p) => `${(p.x - box.minX).toFixed(2)} ${(box.maxY - p.y).toFixed(2)}`).join('L')}Z`
      )
      .join('');
    return {
      d,
      viewBox: `${-pad} ${-pad} ${box.maxX - box.minX + 2 * pad} ${box.maxY - box.minY + 2 * pad}`,
    };
  }, [params]);
  if (!drawing) return null;
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={drawing.viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="text-content-tertiary"
    >
      <path d={drawing.d} fill="currentColor" fillOpacity={0.25} fillRule="evenodd" />
    </svg>
  );
}

export function LibraryThumbnail({ item, size }: LibraryThumbnailProps) {
  const version = `${item.id}@${item.updatedAt}`;
  const [ready, setReady] = useState<{ version: string; url: string } | null>(null);
  const itemRef = useLatestRef(item);
  useEffect(
    () => requestThumbnail(itemRef.current, (url) => setReady({ version, url })),
    [version, itemRef]
  );
  const url = ready?.version === version ? ready.url : null;
  if (url) {
    return <img src={url} alt="" width={size} height={size} className="object-contain" />;
  }
  return <LibraryOutline item={item} size={size} />;
}
