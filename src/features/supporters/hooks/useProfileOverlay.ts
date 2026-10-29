import { useCallback, useMemo, useState } from 'react';
import type { SupporterEditError, SupporterProfilePatch } from '../api/supporterClient';
import type { SupportersData } from '../utils/supportersData';
import type { UseSupporterStatus } from './useSupporterStatus';

/** The caller's record as it stood before their first save, to find it again. */
interface SavedEdit {
  prevName: string | null;
  joinedAt?: string;
  department?: number;
}

export interface ProfileOverlay {
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
  const [edit, setEdit] = useState<SavedEdit | null>(null);

  const saveProfile = useCallback(
    async (patch: SupporterProfilePatch) => {
      const { name, joinedAt, department } = supporter.status;
      const error = await supporter.save(patch);
      // Keep the ORIGINAL handle across repeated renames: after the first save
      // `status.name` is already the new name, which the public list has never
      // carried, so recording it would strand the overlay.
      if (error === null) setEdit((prev) => prev ?? { prevName: name, joinedAt, department });
      return error;
    },
    [supporter]
  );

  const effective = useMemo(() => {
    const status = supporter.status;
    // A different account signed in since the save (another tab): the edit isn't theirs.
    if (!edit || !status.supporter || status.joinedAt !== edit.joinedAt) return supporters;
    const records = supporters.supporters.slice();
    // Two people can share a name, so the join date and department narrow the
    // match. A named record that is still ambiguous is left alone rather than
    // guessed at; anonymous records are interchangeable on the page.
    let candidates = records.flatMap((r, i) => (r.name === edit.prevName ? [i] : []));
    const narrow = (keep: (i: number) => boolean) => {
      const kept = candidates.filter(keep);
      if (kept.length > 0) candidates = kept;
    };
    if (edit.joinedAt) narrow((i) => records[i].joinedAt === edit.joinedAt);
    if (edit.department !== undefined) narrow((i) => records[i].department === edit.department);
    const idx = candidates.at(0);
    // Edits an existing record, never adds one: a push would double the
    // caller's bin while the headline count reads the raw list.
    if (idx === undefined || (edit.prevName !== null && candidates.length > 1)) return supporters;
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
