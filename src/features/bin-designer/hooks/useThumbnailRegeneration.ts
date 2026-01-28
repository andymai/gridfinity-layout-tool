/**
 * Hook to lazily regenerate thumbnails for designs that are missing or outdated.
 *
 * When the design list dialog is open, scans loaded designs for those with
 * `thumbnail === null` or `thumbnailVersion < THUMBNAIL_VERSION`, and regenerates
 * them one at a time using an offscreen Three.js renderer.
 *
 * Updates IndexedDB and the local designs array as each thumbnail completes.
 */

import { useEffect, useRef } from 'react';
import type { SavedDesign } from '../types';
import { THUMBNAIL_VERSION } from '../types';
import { regenerateThumbnail } from '../utils/thumbnailRegenerator';
import { updateDesignThumbnail } from '../storage/DesignerStorage';
import { upsertRegistryEntry } from '../store/customBinRegistry';
import { isOk } from '@/core/result';

/**
 * Lazily regenerate thumbnails for designs that need them.
 *
 * @param designs - Current list of saved designs
 * @param onDesignUpdated - Callback when a design's thumbnail has been regenerated
 */
export function useThumbnailRegeneration(
  designs: readonly SavedDesign[],
  onDesignUpdated: (id: string, thumbnail: string) => void
): void {
  const abortRef = useRef<AbortController | null>(null);
  const processedRef = useRef<Set<string>>(new Set());
  // Use ref to always access the latest callback without re-triggering the effect
  const onDesignUpdatedRef = useRef(onDesignUpdated);
  useEffect(() => {
    onDesignUpdatedRef.current = onDesignUpdated;
  }, [onDesignUpdated]);

  useEffect(() => {
    // Find designs needing thumbnail regeneration
    const needsRegen = designs.filter(
      (d) =>
        (!d.thumbnail || (d.thumbnailVersion ?? 0) < THUMBNAIL_VERSION) &&
        !processedRef.current.has(d.id)
    );

    if (needsRegen.length === 0) return;

    // Cancel any previous run
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    void (async () => {
      for (const design of needsRegen) {
        if (controller.signal.aborted) break;

        const thumbnail = await regenerateThumbnail(design.params, controller.signal);

        // On abort, don't mark as processed so designs can retry next time
        if (controller.signal.aborted) break;

        if (!thumbnail) {
          // Generation failed — skip but don't mark as processed so it can retry
          continue;
        }

        // Persist to IndexedDB
        const result = await updateDesignThumbnail(design.id, thumbnail);
        if (controller.signal.aborted) break;

        if (isOk(result)) {
          // Mark as successfully processed
          processedRef.current.add(design.id);

          // Update custom bin registry
          upsertRegistryEntry({
            id: design.id,
            name: design.name,
            width: design.params.width,
            depth: design.params.depth,
            height: design.params.height,
            thumbnail,
            updatedAt: result.value.updatedAt,
          });

          // Notify parent to update local state
          onDesignUpdatedRef.current(design.id, thumbnail);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [designs]);
}
