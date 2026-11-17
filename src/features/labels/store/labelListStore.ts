/**
 * A scratch list in this browser, not layout data: no sync, undo or share. A
 * layout's own labels stay on its bins.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { generateId } from '@/core/constants';
import { isLabelPrinterId, isTapeLength } from '../utils/labelMedia';
import type { LabelPrinterId, TapeLength } from '../utils/labelMedia';
import type { ParsedLabel } from '../utils/parseLabelList';

export const LABEL_LIST_STORAGE_KEY = 'gridfinity-labels-v1';
export const LABEL_LIST_MAX = 200;
export const LABEL_NAME_MAX_LENGTH = 120;
export const LABEL_DETAIL_MAX_LENGTH = 40;
export const LABEL_COPIES_MAX = 99;

export interface LabelEntry {
  readonly id: string;
  readonly name: string;
  readonly detail: string;
  readonly copies: number;
}

interface LabelListState {
  entries: readonly LabelEntry[];
  printerId: LabelPrinterId;
  mediaId: string;
  tapeLength: TapeLength;

  addEntries: (rows: readonly ParsedLabel[]) => number;
  updateEntry: (id: string, patch: Partial<Omit<LabelEntry, 'id'>>) => void;
  removeEntry: (id: string) => void;
  clearEntries: () => void;
  setPrinter: (printerId: LabelPrinterId, mediaId: string) => void;
  setMediaId: (mediaId: string) => void;
  setTapeLength: (tapeLength: TapeLength) => void;
}

function clampCopies(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(LABEL_COPIES_MAX, Math.max(1, Math.round(value)));
}

function sanitizeEntry(raw: unknown): LabelEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { id, name, detail, copies } = raw as Record<string, unknown>;
  if (typeof id !== 'string' || typeof name !== 'string') return null;
  return {
    id,
    name: name.slice(0, LABEL_NAME_MAX_LENGTH),
    detail: typeof detail === 'string' ? detail.slice(0, LABEL_DETAIL_MAX_LENGTH) : '',
    copies: typeof copies === 'number' ? clampCopies(copies) : 1,
  };
}

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export const useLabelListStore = create<LabelListState>()(
  persist(
    (set, get) => ({
      entries: [],
      printerId: 'brother-pt',
      mediaId: '12',
      tapeLength: 'fit',

      addEntries: (rows) => {
        const room = LABEL_LIST_MAX - get().entries.length;
        const added = rows.slice(0, Math.max(0, room)).map((row) => ({
          id: generateId(),
          name: row.name.slice(0, LABEL_NAME_MAX_LENGTH),
          detail: row.detail.slice(0, LABEL_DETAIL_MAX_LENGTH),
          copies: 1,
        }));
        if (added.length > 0) set((state) => ({ entries: [...state.entries, ...added] }));
        return added.length;
      },
      updateEntry: (id, patch) =>
        set((state) => ({
          entries: state.entries.map((entry) => {
            if (entry.id !== id) return entry;
            return {
              ...entry,
              ...(patch.name !== undefined && { name: patch.name.slice(0, LABEL_NAME_MAX_LENGTH) }),
              ...(patch.detail !== undefined && {
                detail: patch.detail.slice(0, LABEL_DETAIL_MAX_LENGTH),
              }),
              ...(patch.copies !== undefined && { copies: clampCopies(patch.copies) }),
            };
          }),
        })),
      removeEntry: (id) =>
        set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) })),
      clearEntries: () => set({ entries: [] }),
      setPrinter: (printerId, mediaId) => set({ printerId, mediaId }),
      setMediaId: (mediaId) => set({ mediaId }),
      setTapeLength: (tapeLength) => set({ tapeLength }),
    }),
    {
      name: LABEL_LIST_STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof localStorage !== 'undefined' ? localStorage : noopStorage
      ),
      partialize: (state) => ({
        entries: state.entries,
        printerId: state.printerId,
        mediaId: state.mediaId,
        tapeLength: state.tapeLength,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        const entries = Array.isArray(p.entries)
          ? p.entries
              .map(sanitizeEntry)
              .filter((entry): entry is LabelEntry => entry !== null)
              .slice(0, LABEL_LIST_MAX)
          : current.entries;
        return {
          ...current,
          entries,
          printerId: isLabelPrinterId(p.printerId) ? p.printerId : current.printerId,
          mediaId: typeof p.mediaId === 'string' ? p.mediaId : current.mediaId,
          tapeLength: isTapeLength(p.tapeLength) ? p.tapeLength : current.tapeLength,
        };
      },
    }
  )
);
