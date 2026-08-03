import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunityPrint } from '@/shared/types/communityPrint';
import {
  DEFAULT_PRINT_DRAFT,
  INITIAL_PRINT_DIALOG_STATE,
  draftPrintMinutes,
  hasPrintDraftIssues,
  usePrintDialogStore,
  validatePrintDraft,
} from './printDialogStore';

vi.mock('../utils/displayName', () => ({
  loadDisplayName: () => 'Stored Name',
  saveDisplayName: vi.fn(),
}));

const EXISTING: CommunityPrint = {
  id: 'abc123def456:aaa',
  designId: 'abc123def456',
  authorPublicId: 'a'.repeat(32),
  authorName: 'Record Name',
  photos: ['https://blob.example/p0.webp'],
  settings: {
    material: 'petg',
    nozzleMm: 0.6,
    layerHeightMm: 0.28,
    printMinutes: 145,
    filamentGrams: 22,
    printer: 'other',
    printerOther: 'Toolchanger',
  },
  fitVerdict: 'adjusted',
  note: 'scaled 2 percent',
  createdAt: 1000,
  updatedAt: 2000,
  status: 'live',
};

beforeEach(() => {
  usePrintDialogStore.setState({ ...INITIAL_PRINT_DIALOG_STATE });
});

describe('open', () => {
  it('starts a signed-in create at the form with the stored display name', () => {
    usePrintDialogStore.getState().open({
      designId: 'abc123def456',
      designName: 'Socket Organizer',
      signedIn: true,
      existing: null,
    });

    const state = usePrintDialogStore.getState();
    expect(state.phase).toBe('form');
    expect(state.mode).toBe('create');
    expect(state.displayName).toBe('Stored Name');
    expect(state.draft).toEqual(DEFAULT_PRINT_DRAFT);
    expect(state.photos).toEqual([]);
  });

  it('routes a signed-out caller to sign-in first', () => {
    usePrintDialogStore.getState().open({
      designId: 'abc123def456',
      designName: 'Socket Organizer',
      signedIn: false,
      existing: null,
    });

    expect(usePrintDialogStore.getState().phase).toBe('signin');
  });

  it('hydrates an edit from the existing record', () => {
    usePrintDialogStore.getState().open({
      designId: 'abc123def456',
      designName: 'Socket Organizer',
      signedIn: true,
      existing: EXISTING,
    });

    const state = usePrintDialogStore.getState();
    expect(state.mode).toBe('edit');
    // The record's own name wins over local storage, so a rename stays deliberate.
    expect(state.displayName).toBe('Record Name');
    expect(state.draft.material).toBe('petg');
    expect(state.draft.printerOther).toBe('Toolchanger');
    expect(state.draft.fitVerdict).toBe('adjusted');
    // 145 minutes splits into the two inputs the form shows.
    expect(state.draft.printHours).toBe('2');
    expect(state.draft.printMinutes).toBe('25');
    expect(state.photos).toEqual([{ kind: 'kept', url: 'https://blob.example/p0.webp' }]);
  });

  it('leaves fitVerdict unset on a new report', () => {
    usePrintDialogStore.getState().open({
      designId: 'abc123def456',
      designName: 'Socket Organizer',
      signedIn: true,
      existing: null,
    });

    // A verdict nobody consciously chose is worse than no verdict at all.
    expect(usePrintDialogStore.getState().draft.fitVerdict).toBeNull();
  });
});

describe('photos', () => {
  beforeEach(() => {
    usePrintDialogStore.getState().open({
      designId: 'abc123def456',
      designName: 'Socket Organizer',
      signedIn: true,
      existing: null,
    });
  });

  it('appends new photos as unsaved slots', () => {
    usePrintDialogStore.getState().addPhoto('data:image/webp;base64,AAA');
    expect(usePrintDialogStore.getState().photos).toEqual([
      { kind: 'new', url: 'data:image/webp;base64,AAA' },
    ]);
  });

  it('refuses to exceed the photo cap', () => {
    for (let i = 0; i < 6; i++) {
      usePrintDialogStore.getState().addPhoto(`data:image/webp;base64,${i}`);
    }
    expect(usePrintDialogStore.getState().photos).toHaveLength(4);
  });

  it('removes by position, keeping the rest in order', () => {
    for (const tag of ['a', 'b', 'c']) {
      usePrintDialogStore.getState().addPhoto(`data:image/webp;base64,${tag}`);
    }
    usePrintDialogStore.getState().removePhoto(1);
    expect(usePrintDialogStore.getState().photos.map((p) => p.url)).toEqual([
      'data:image/webp;base64,a',
      'data:image/webp;base64,c',
    ]);
  });

  it('clears a stale photo error once one lands', () => {
    usePrintDialogStore.getState().setPhotoError('boom');
    usePrintDialogStore.getState().addPhoto('data:image/webp;base64,AAA');
    expect(usePrintDialogStore.getState().photoError).toBeNull();
  });
});

describe('draftPrintMinutes', () => {
  it('sums the split hour and minute inputs', () => {
    expect(draftPrintMinutes({ ...DEFAULT_PRINT_DRAFT, printHours: '2', printMinutes: '5' })).toBe(
      125
    );
  });

  it('accepts an hours-only entry', () => {
    expect(draftPrintMinutes({ ...DEFAULT_PRINT_DRAFT, printHours: '3' })).toBe(180);
  });

  it('accepts a minutes-only entry', () => {
    expect(draftPrintMinutes({ ...DEFAULT_PRINT_DRAFT, printMinutes: '45' })).toBe(45);
  });

  it('rejects an empty entry', () => {
    expect(draftPrintMinutes(DEFAULT_PRINT_DRAFT)).toBeNull();
  });

  it('rejects a zero total rather than posting a zero-length print', () => {
    expect(
      draftPrintMinutes({ ...DEFAULT_PRINT_DRAFT, printHours: '0', printMinutes: '0' })
    ).toBeNull();
  });

  it('rejects non-numeric text', () => {
    expect(draftPrintMinutes({ ...DEFAULT_PRINT_DRAFT, printHours: 'soon' })).toBeNull();
  });
});

describe('validatePrintDraft', () => {
  const complete = {
    ...DEFAULT_PRINT_DRAFT,
    printer: 'bambu-p1s',
    printHours: '2',
    fitVerdict: 'as-designed' as const,
  };

  it('passes a complete draft', () => {
    expect(hasPrintDraftIssues(validatePrintDraft(complete, 'Casey'))).toBe(false);
  });

  it('requires a display name', () => {
    expect(validatePrintDraft(complete, '   ').displayName).toBe('required');
  });

  it('requires a printer', () => {
    expect(validatePrintDraft({ ...complete, printer: '' }, 'Casey').printer).toBe('required');
  });

  it('requires the free-text model when the printer is "other"', () => {
    expect(validatePrintDraft({ ...complete, printer: 'other' }, 'Casey').printer).toBe(
      'otherRequired'
    );
  });

  it('accepts "other" once the model is filled in', () => {
    const issues = validatePrintDraft(
      { ...complete, printer: 'other', printerOther: 'Toolchanger' },
      'Casey'
    );
    expect(issues.printer).toBeUndefined();
  });

  it('requires a print time', () => {
    expect(validatePrintDraft({ ...complete, printHours: '' }, 'Casey').printTime).toBe('required');
  });

  it('requires a fit verdict', () => {
    expect(validatePrintDraft({ ...complete, fitVerdict: null }, 'Casey').fitVerdict).toBe(
      'required'
    );
  });

  it.each([
    ['nozzleMm', ''],
    ['nozzleMm', '0'],
    ['layerHeightMm', ''],
    ['layerHeightMm', '-1'],
  ])('requires a positive %s (%s)', (field, value) => {
    const issues = validatePrintDraft({ ...complete, [field]: value }, 'Casey');
    expect(issues[field as 'nozzleMm' | 'layerHeightMm']).toBe('required');
  });
});

describe('phase transitions', () => {
  it('clears the error when returning to the form', () => {
    usePrintDialogStore.getState().fail({ kind: 'server' });
    expect(usePrintDialogStore.getState().phase).toBe('error');
    usePrintDialogStore.getState().backToForm();
    expect(usePrintDialogStore.getState()).toMatchObject({ phase: 'form', error: null });
  });

  it('reset returns to the closed initial state', () => {
    usePrintDialogStore.getState().open({
      designId: 'abc123def456',
      designName: 'Socket Organizer',
      signedIn: true,
      existing: EXISTING,
    });
    usePrintDialogStore.getState().reset();
    expect(usePrintDialogStore.getState()).toMatchObject(INITIAL_PRINT_DIALOG_STATE);
  });
});
