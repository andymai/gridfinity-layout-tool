/**
 * Once per page load, when the browser is idle: move meshes saved inline into
 * the mesh store, then sweep files nothing names. The sweep's grace period is
 * what makes any moment safe, an import in progress included.
 */

import { useEffect } from 'react';
import { createLogger } from '@/core/logger';
import { cancelIdleCallback, scheduleIdleCallback } from '@/shared/utils/idle';

const logger = createLogger('MeshFiles');

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
}
