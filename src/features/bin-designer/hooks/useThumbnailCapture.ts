/**
 * Hook to capture thumbnail after mesh generation completes.
 *
 * When a design is created from a bin in the layout planner, the initial save
 * happens before the mesh is ready, so the thumbnail is null. This hook watches
 * for generation to complete and captures the thumbnail, updating both IndexedDB
 * and the custom bin registry.
 */

import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '../store';
import { captureThumbnailAtPreset } from '../utils/thumbnail';
import { updateDesignThumbnail } from '../storage/DesignerStorage';
import { upsertRegistryEntry } from '../store/customBinRegistry';
import { isOk } from '@/core/result';

/**
 * Captures thumbnail after first successful mesh generation when needed.
 *
 * This hook solves the race condition where designs created from bins in the
 * layout planner are saved before their mesh is generated, resulting in a
 * null thumbnail.
 */
export function useThumbnailCapture(): void {
  const prevStatusRef = useRef<string>('');

  const { generationStatus, needsThumbnailUpdate, currentDesignId, params, designName } =
    useDesignerStore(
      useShallow((s) => ({
        generationStatus: s.generation.status,
        needsThumbnailUpdate: s.needsThumbnailUpdate,
        currentDesignId: s.currentDesignId,
        params: s.params,
        designName: s.designName,
      }))
    );

  const setNeedsThumbnailUpdate = useDesignerStore((s) => s.setNeedsThumbnailUpdate);

  useEffect(() => {
    // Only trigger when status transitions TO 'complete'
    if (
      generationStatus !== 'complete' ||
      prevStatusRef.current === 'complete' ||
      !needsThumbnailUpdate ||
      !currentDesignId
    ) {
      prevStatusRef.current = generationStatus;
      return;
    }

    prevStatusRef.current = generationStatus;

    // Delay to ensure React Three Fiber has flushed the completed mesh render
    const timeoutId = setTimeout(() => {
      const thumbnail = captureThumbnailAtPreset({
        width: params.width,
        depth: params.depth,
        height: params.height,
      });
      if (!thumbnail) return;

      // Update IndexedDB and registry
      void updateDesignThumbnail(currentDesignId, thumbnail).then((result) => {
        if (isOk(result)) {
          // Update registry with new thumbnail
          upsertRegistryEntry({
            id: currentDesignId,
            name: designName,
            width: params.width,
            depth: params.depth,
            height: params.height,
            thumbnail,
            updatedAt: result.value.updatedAt,
          });

          // Clear the flag
          setNeedsThumbnailUpdate(false);
        }
      });
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [
    generationStatus,
    needsThumbnailUpdate,
    currentDesignId,
    params.width,
    params.depth,
    params.height,
    designName,
    setNeedsThumbnailUpdate,
  ]);
}
