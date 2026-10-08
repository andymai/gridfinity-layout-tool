/**
 * Once per page load, when the browser is idle: move meshes saved inline into
 * the mesh store, then sweep files nothing names. The sweep's grace period is
 * what makes any moment safe, an import in progress included.
 *
 * For as long as the page stays open, it also renews the last use of every
 * file it has used, so a sweep in another tab cannot take a file that this
 * page's undo history or open designs still name.
 */

import { useEffect } from 'react';
import { createLogger } from '@/core/logger';
import { cancelIdleCallback, scheduleIdleCallback } from '@/shared/utils/idle';

const logger = createLogger('MeshFiles');

/** Well inside the store's refresh interval, so no file's last use goes stale. */
export const MESH_USE_RENEW_EVERY_MS = 60 * 60 * 1000;

let started = false;

export function useMeshFileMaintenance(): void {
  useEffect(() => {
    if (started) return;
    const handle = scheduleIdleCallback(
      () => {
        started = true;
        void import('../storage/DesignerStorage')
          .then(({ maintainMeshFiles }) => maintainMeshFiles())
          .catch((error: unknown) => {
            logger.warn('Mesh file upkeep failed', { error: String(error) });
          });
      },
      { timeout: 10_000 }
    );
    return () => cancelIdleCallback(handle);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void import('../storage/DesignerStorage')
        .then(({ refreshMeshFileUse }) => refreshMeshFileUse())
        .catch((error: unknown) => {
          logger.warn('Mesh file use refresh failed', { error: String(error) });
        });
    }, MESH_USE_RENEW_EVERY_MS);
    return () => clearInterval(timer);
  }, []);
}
