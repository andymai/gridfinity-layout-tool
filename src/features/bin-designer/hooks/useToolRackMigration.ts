/**
 * One-time storage pass converting saved tool racks into Workshop
 * assemblies. Runs once per designer mount; idempotent because a converted
 * row's kind is 'assembly', so subsequent scans find nothing. The original
 * row keeps its id, name, thumbnail, and tags — only kind and geometry
 * change, so layout references and sync lineage survive.
 */
import { useEffect, useRef } from 'react';
import { isOk } from '@/core/result';
import { isMigrationDone, setMigrationDone } from '@/core/storage/localStorageMigrations';
import { listDesigns, saveDesign } from '@/features/bin-designer/storage/DesignerStorage';
import { convertToolRackToAssembly } from '@/features/bin-designer/utils/workshopTemplates';

const MIGRATION_KEY = 'workshop-toolrack-migration-v1';

export function useToolRackMigration(): void {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current || isMigrationDone(MIGRATION_KEY)) return;
    ranRef.current = true;
    void (async () => {
      const designs = await listDesigns();
      if (!isOk(designs)) return;
      for (const design of designs.value) {
        if (design.kind !== 'toolRack') continue;
        if (!design.envelope || design.structure?.kind !== 'toolRack') continue;
        await saveDesign({
          ...design,
          kind: 'assembly',
          structure: convertToolRackToAssembly(design.structure, design.envelope),
        });
      }
      // Marked only after a full successful scan; a thrown save leaves the
      // flag unset so the next visit retries.
      setMigrationDone(MIGRATION_KEY);
    })();
  }, []);
}
