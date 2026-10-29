import { useCallback, useMemo, useState } from 'react';
import type { SupporterEditError, SupporterProfilePatch } from '../api/supporterClient';
import type { SupportersData } from '../utils/supportersData';
import type { UseSupporterStatus } from './useSupporterStatus';

export interface ProfileOverlay {
  /** The supporter list with the caller's own saved edit applied. */
  effective: SupportersData;
  saveProfile: (patch: SupporterProfilePatch) => Promise<SupporterEditError | null>;
}

/**
 * A profile save must show on the wall in the same session, but the list is
 * fetched once and `/api/supporters` is edge-cached (s-maxage 60, SWR 600), so
 * a refetch can keep serving the pre-edit payload for minutes. The edit is
 * applied locally instead: the record is found by its pre-save name (the only
 * handle the public list carries), or by the first anonymous slot for a
 * supporter naming themself for the first time.
 */
export function useProfileOverlay(
  supporters: SupportersData,
  supporter: UseSupporterStatus
): ProfileOverlay {
  const [edit, setEdit] = useState<{ prevName: string | null } | null>(null);

  const saveProfile = useCallback(
    async (patch: SupporterProfilePatch) => {
      const prevName = supporter.status.name;
      const error = await supporter.save(patch);
      // Keep the ORIGINAL handle across repeated renames: after the first save
      // `status.name` is already the new name, which the public list has never
      // carried, so recording it would strand the overlay.
      if (error === null) setEdit((prev) => prev ?? { prevName });
      return error;
    },
    [supporter]
  );

  const effective = useMemo(() => {
    const status = supporter.status;
    if (!edit || !status.supporter) return supporters;
    const records = supporters.supporters.slice();
    const idx =
      edit.prevName !== null
        ? records.findIndex((r) => r.name === edit.prevName)
        : records.findIndex((r) => r.name === null);
    // Edits an existing record, never adds one: a push would double the
    // caller's bin while the headline count reads the raw list.
    if (idx < 0) return supporters;
    const current = records[idx];
    records[idx] =
      status.name === null
        ? { ...current, name: null, message: undefined, department: undefined }
        : {
            ...current,
            name: status.name,
            message: status.message ?? undefined,
            // An anonymous record carries no department; the caller's own status does.
            department: status.department ?? current.department,
          };
    return { ...supporters, supporters: records };
  }, [supporters, supporter.status, edit]);

  return { effective, saveProfile };
}
