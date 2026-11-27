import { useEffect, useState } from 'react';
import type { LayoutPreview } from '@/core/types';
import { useTranslation } from '@/i18n';
import type { YearReviewData } from './useYearReviewData';
import type { YearMesh } from './useYearMeshes';

export interface SampleYearData {
  readonly data: YearReviewData;
  readonly drawerPreview: LayoutPreview | null;
  readonly meshes: ReadonlyMap<string, YearMesh>;
  /** The bake's counts, known before the meshes load. */
  readonly triangles: ReadonlyMap<string, number>;
}

const NO_MESHES: ReadonlyMap<string, YearMesh> = new Map();
const NO_TRIANGLES: ReadonlyMap<string, number> = new Map();

async function importAssets() {
  const [{ SAMPLE_SOURCE, sampleMeshesUrl, sampleThumbnail }, sample] = await Promise.all([
    import('../data/sampleAssets'),
    import('../utils/sampleYear'),
  ]);
  return { SAMPLE_SOURCE, sampleMeshesUrl, sampleThumbnail, ...sample };
}

/**
 * Per session, so a replay or a return from the credits fetches nothing twice.
 * One promise each, because the stats and the meshes ask for the assets in
 * the same tick.
 */
let sessionAssets: ReturnType<typeof importAssets> | null = null;
let sessionMeshes: Promise<ReadonlyMap<string, YearMesh>> | null = null;

function loadAssets(): ReturnType<typeof importAssets> {
  sessionAssets ??= importAssets().catch((error: unknown) => {
    sessionAssets = null;
    throw error;
  });
  return sessionAssets;
}

function loadMeshes(): Promise<ReadonlyMap<string, YearMesh>> {
  sessionMeshes ??= Promise.all([loadAssets(), import('../utils/sampleMeshes')])
    .then(([assets, { loadSampleMeshes }]) =>
      loadSampleMeshes(assets.sampleMeshesUrl(), assets.sampleTriangles(assets.SAMPLE_SOURCE))
    )
    .catch(() => {
      // A failed fetch keeps the thumbnails, and the next play tries again.
      sessionMeshes = null;
      return NO_MESHES;
    });
  return sessionMeshes;
}

/**
 * The sample year for `?demo`: fixed stats and baked meshes, with no storage
 * reads, no kernel and no generation. The stats come first, so the cards play
 * while the meshes load, as the real year plays while its meshes generate.
 */
export function useSampleYear(enabled: boolean): SampleYearData {
  const t = useTranslation();
  const [state, setState] = useState<Omit<SampleYearData, 'meshes'>>({
    data: { status: 'loading' },
    drawerPreview: null,
    triangles: NO_TRIANGLES,
  });
  const [meshes, setMeshes] = useState<ReadonlyMap<string, YearMesh>>(NO_MESHES);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadAssets().then(
      ({ SAMPLE_SOURCE, sampleThumbnail, sampleTriangles, sampleYear }) => {
        if (cancelled) return;
        const sample = sampleYear(SAMPLE_SOURCE, {
          design: (key) => t(key),
          drawer: t('your2026.sample.drawer'),
          thumbnail: sampleThumbnail,
        });
        setState({
          data: { status: 'ready', stats: sample.stats },
          drawerPreview: sample.drawerPreview,
          triangles: sampleTriangles(SAMPLE_SOURCE),
        });
      },
      () => {
        if (!cancelled) {
          setState({ data: { status: 'error' }, drawerPreview: null, triangles: NO_TRIANGLES });
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, t]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadMeshes().then((loaded) => {
      if (!cancelled) setMeshes(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { ...state, meshes };
}

export function __resetSampleYearForTests(): void {
  sessionAssets = null;
  sessionMeshes = null;
}
