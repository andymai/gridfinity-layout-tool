import { create } from 'zustand';
import type {
  CommunityPrint,
  CommunityPrintFitVerdict,
  CommunityPrintMaterial,
} from '@/shared/types/communityPrint';
import { COMMUNITY_PRINT_MAX_PHOTOS } from '@/shared/types/communityPrint';
import { COMMUNITY_PRINTER_OTHER } from '@/shared/types/communityPrinters';
import type { CommunityClientError } from '../api/client';
import { loadDisplayName } from '../utils/displayName';

export type PrintDialogPhase = 'closed' | 'signin' | 'form' | 'saving' | 'error';

export type PrintDialogMode = 'create' | 'edit';

/**
 * A photo slot is either an already-stored URL carried over from the record
 * being edited, or a freshly prepared WebP data URL. Both go to the server as
 * plain strings in one ordered array; the distinction is kept here so the UI
 * can label a kept photo and skip re-preparing it.
 */
export interface PrintPhotoSlot {
  readonly kind: 'kept' | 'new';
  readonly url: string;
  /**
   * Browsing-sized copy of a freshly prepared photo, travelling with it rather
   * than in a second array so the two cannot fall out of order when slots are
   * added, removed or reordered. Null on a kept slot (the server already holds
   * its copy) and on a photo small enough to be its own.
   */
  readonly thumbUrl?: string | null;
}

/**
 * Form fields as typed, before coercion. Numeric inputs stay strings so a
 * half-typed "0." does not round-trip through Number() and erase the cursor.
 */
export interface PrintDraft {
  material: CommunityPrintMaterial;
  nozzleMm: string;
  layerHeightMm: string;
  printHours: string;
  printMinutes: string;
  filamentGrams: string;
  printer: string;
  printerOther: string;
  fitVerdict: CommunityPrintFitVerdict | null;
  note: string;
}

interface PrintDialogState {
  phase: PrintDialogPhase;
  mode: PrintDialogMode;
  designId: string;
  designName: string;
  displayName: string;
  draft: PrintDraft;
  photos: readonly PrintPhotoSlot[];
  error: CommunityClientError | null;
  /** Non-null while a photo is being downscaled and re-encoded. */
  photoError: string | null;
}

export interface OpenPrintDialogPayload {
  designId: string;
  designName: string;
  signedIn: boolean;
  /** The caller's existing print, when they are editing rather than posting. */
  existing: CommunityPrint | null;
}

interface PrintDialogActions {
  open: (payload: OpenPrintDialogPayload) => void;
  completeSignIn: () => void;
  setDraft: (patch: Partial<PrintDraft>) => void;
  setDisplayName: (name: string) => void;
  addPhoto: (dataUrl: string, thumbDataUrl?: string | null) => void;
  removePhoto: (index: number) => void;
  setPhotoError: (message: string | null) => void;
  beginSaving: () => void;
  fail: (error: CommunityClientError) => void;
  backToForm: () => void;
  reset: () => void;
}

export type PrintDialogStore = PrintDialogState & PrintDialogActions;

/**
 * Defaults chosen as the most common real answer rather than as empty fields:
 * 0.4mm nozzle at 0.2mm layers is what the overwhelming majority of these
 * machines ship with, so most reporters change nothing here. `fitVerdict` is
 * deliberately null: it is the one field nobody should be able to submit
 * without having actually decided.
 */
export const DEFAULT_PRINT_DRAFT: PrintDraft = {
  material: 'pla',
  nozzleMm: '0.4',
  layerHeightMm: '0.2',
  printHours: '',
  printMinutes: '',
  filamentGrams: '',
  printer: '',
  printerOther: '',
  fitVerdict: null,
  note: '',
};

export const INITIAL_PRINT_DIALOG_STATE: PrintDialogState = {
  phase: 'closed',
  mode: 'create',
  designId: '',
  designName: '',
  displayName: '',
  draft: DEFAULT_PRINT_DRAFT,
  photos: [],
  error: null,
  photoError: null,
};

/** An unreported setting reopens as an empty field, never as a fabricated 0. */
function numberField(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

function draftFromPrint(print: CommunityPrint): PrintDraft {
  const total = print.settings.printMinutes;
  return {
    material: print.settings.material ?? DEFAULT_PRINT_DRAFT.material,
    nozzleMm: numberField(print.settings.nozzleMm),
    layerHeightMm: numberField(print.settings.layerHeightMm),
    printHours: total === undefined ? '' : String(Math.floor(total / 60)),
    printMinutes: total === undefined ? '' : String(total % 60),
    filamentGrams: numberField(print.settings.filamentGrams),
    printer: print.settings.printer ?? '',
    printerOther: print.settings.printerOther ?? '',
    fitVerdict: print.fitVerdict,
    note: print.note,
  };
}

export const usePrintDialogStore = create<PrintDialogStore>((set, get) => ({
  ...INITIAL_PRINT_DIALOG_STATE,

  open: ({ designId, designName, signedIn, existing }) =>
    set({
      ...INITIAL_PRINT_DIALOG_STATE,
      phase: signedIn ? 'form' : 'signin',
      mode: existing === null ? 'create' : 'edit',
      designId,
      designName,
      // An edit reuses the name already on the record so a rename is a
      // deliberate act, not a side effect of whatever is in local storage.
      displayName: existing === null ? loadDisplayName() : existing.authorName,
      draft: existing === null ? DEFAULT_PRINT_DRAFT : draftFromPrint(existing),
      photos: existing === null ? [] : existing.photos.map((url) => ({ kind: 'kept', url })),
    }),

  completeSignIn: () => set({ phase: 'form', displayName: loadDisplayName() }),

  setDraft: (patch) => set({ draft: { ...get().draft, ...patch } }),

  setDisplayName: (displayName) => set({ displayName }),

  addPhoto: (url, thumbUrl = null) => {
    const photos = get().photos;
    if (photos.length >= COMMUNITY_PRINT_MAX_PHOTOS) return;
    set({ photos: [...photos, { kind: 'new', url, thumbUrl }], photoError: null });
  },

  removePhoto: (index) => set({ photos: get().photos.filter((_, position) => position !== index) }),

  setPhotoError: (photoError) => set({ photoError }),

  beginSaving: () => set({ phase: 'saving', error: null }),

  fail: (error) => set({ phase: 'error', error }),

  backToForm: () => set({ phase: 'form', error: null }),

  reset: () => set(INITIAL_PRINT_DIALOG_STATE),
}));

export interface PrintDraftIssues {
  /** Only the free-text half: a blank printer select is an acceptable answer now. */
  printer?: 'otherRequired';
  fitVerdict?: 'required';
  displayName?: 'required';
  /** Neither a photo nor a note, so the record would carry only a bare vote. */
  content?: 'required';
}

/** Minutes from the split hours/minutes inputs, or null when neither is usable. */
export function draftPrintMinutes(draft: PrintDraft): number | null {
  const hours = draft.printHours.trim() === '' ? 0 : Number(draft.printHours);
  const minutes = draft.printMinutes.trim() === '' ? 0 : Number(draft.printMinutes);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const total = Math.round(hours * 60 + minutes);
  return total > 0 ? total : null;
}

/**
 * Client-side mirror of the server's required fields. It exists to give an
 * inline message instead of a round trip, not to be authoritative: the server
 * revalidates everything and is the only thing that decides.
 *
 * Every print setting is optional. What is left is the fit verdict — the one
 * thing that cannot be produced without having printed the design — plus a
 * photo or a note, so the record says something beyond a bare vote.
 */
export function validatePrintDraft(
  draft: PrintDraft,
  displayName: string,
  photoCount: number
): PrintDraftIssues {
  const issues: PrintDraftIssues = {};
  if (displayName.trim() === '') issues.displayName = 'required';
  // The free-text model is only readable next to the 'other' sentinel, so it
  // is demanded by that choice rather than on its own.
  if (draft.printer === COMMUNITY_PRINTER_OTHER && draft.printerOther.trim() === '') {
    issues.printer = 'otherRequired';
  }
  if (draft.fitVerdict === null) issues.fitVerdict = 'required';
  if (photoCount === 0 && draft.note.trim() === '') issues.content = 'required';
  return issues;
}

export function hasPrintDraftIssues(issues: PrintDraftIssues): boolean {
  return Object.keys(issues).length > 0;
}
