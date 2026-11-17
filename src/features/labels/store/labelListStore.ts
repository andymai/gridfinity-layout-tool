/**
 * A scratch list in this browser, not layout data: no sync, undo or share. A
 * layout's own labels stay on its bins.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { generateId } from '@/core/constants';
import { isLabelPrinterId, isTapeLength } from '../utils/labelMedia';
import type { LabelPrinterId, TapeLength } from '../utils/labelMedia';
import type { LabelText } from '../utils/planLabel';

export const LABEL_LIST_STORAGE_KEY = 'gridfinity-labels-v1';
export const LABEL_LIST_MAX = 200;
export const LABEL_NAME_MAX_LENGTH = 120;
export const LABEL_DETAIL_MAX_LENGTH = 40;
export const LABEL_COPIES_MAX = 99;

export interface LabelEntry extends LabelText {
  readonly id: string;
  readonly copies: number;
}

interface LabelListState {
  entries: readonly LabelEntry[];
  printerId: LabelPrinterId;
  mediaId: string;
  tapeLength: TapeLength;

  addEntries: (rows: readonly LabelText[]) => number;
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

function clampEntry(entry: LabelEntry): LabelEntry {
  return {
    id: entry.id,
    name: entry.name.slice(0, LABEL_NAME_MAX_LENGTH),
    detail: entry.detail.slice(0, LABEL_DETAIL_MAX_LENGTH),
    copies: clampCopies(entry.copies),
  };
}

function sanitizeEntry(raw: unknown): LabelEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { id, name, detail, copies } = raw as Record<string, unknown>;
  if (typeof id !== 'string' || typeof name !== 'string') return null;
  return clampEntry({
    id,
    name,
    detail: typeof detail === 'string' ? detail : '',
    copies: typeof copies === 'number' ? copies : 1,
  });
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
        const added = rows
          .slice(0, Math.max(0, room))
          .map((row) =>
            clampEntry({ id: generateId(), name: row.name, detail: row.detail, copies: 1 })
          );
        if (added.length > 0) set((state) => ({ entries: [...state.entries, ...added] }));
        return added.length;
      },
      updateEntry: (id, patch) =>
        set((state) => ({
          entries: state.entries.map((entry) => {
            if (entry.id !== id) return entry;
            return clampEntry({
              id,
              name: patch.name ?? entry.name,
              detail: patch.detail ?? entry.detail,
              copies: patch.copies ?? entry.copies,
            });
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
