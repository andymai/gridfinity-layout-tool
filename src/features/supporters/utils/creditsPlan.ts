import { SUPPORTER_DEPARTMENT_COUNT, isSupporterDepartment } from '../constants';
import type { SupporterBin } from './supportersData';

/** Anonymous supporters roll last, in a zone of their own. */
export const REDACTED_DEPARTMENT = SUPPORTER_DEPARTMENT_COUNT;

/**
 * Index = department number from the server. The order is part of the
 * contract: reordering renames every supporter's department.
 */
export const DEPARTMENT_TITLE_KEYS = [
  'supporters.credits.dept.oneMoreBin',
  'supporters.credits.dept.spaghetti',
  'supporters.credits.dept.magnetHoles',
  'supporters.credits.dept.firstLayer',
  'supporters.credits.dept.measureTwice',
  'supporters.credits.dept.cloggedNozzle',
  'supporters.credits.dept.almostFit',
  'supporters.credits.dept.lipQa',
  'supporters.credits.dept.redacted',
] as const;

export const DEPARTMENT_NOTE_KEYS: Partial<Record<number, string>> = {
  2: 'supporters.credits.dept.magnetHolesNote',
};

/** Ko-fi's name for a supporter who left the name field blank. */
export const KOFI_DEFAULT_NAME = 'Somebody';

export type CreditItem =
  | { kind: 'department'; id: string; department: number }
  /** A heading with no zone of its own: the camera takes in the whole plate. */
  | { kind: 'section'; id: string; titleKey: string; noteKey: string }
  | { kind: 'names'; id: string; binIds: string[] }
  /** Many supporters sharing one name, credited on a single line. */
  | { kind: 'crowd'; id: string; binIds: string[] }
  | { kind: 'message'; id: string; binId: string }
  | { kind: 'gag'; id: string; roleKey: string; valueKey: string }
  | { kind: 'note'; id: string; textKey: string };

export interface CreditSeat {
  zone: number;
  /** Position in the zone, in the order the names roll. */
  slot: number;
}

export interface CreditsPlan {
  items: CreditItem[];
  seats: Map<string, CreditSeat>;
  /** Members per zone, indexed like `DEPARTMENT_TITLE_KEYS`. */
  zoneSizes: number[];
}

const GAGS_AFTER: Partial<Record<number, CreditItem[]>> = {
  1: [
    {
      kind: 'gag',
      id: 'gag-catering',
      roleKey: 'supporters.credits.gag.cateringRole',
      valueKey: 'supporters.credits.gag.cateringValue',
    },
  ],
  2: [
    {
      kind: 'gag',
      id: 'gag-magnet-retrieval',
      roleKey: 'supporters.credits.gag.magnetRetrievalRole',
      valueKey: 'supporters.credits.gag.magnetRetrievalValue',
    },
  ],
  4: [
    {
      kind: 'gag',
      id: 'gag-continuity',
      roleKey: 'supporters.credits.gag.continuityRole',
      valueKey: 'supporters.credits.gag.continuityValue',
    },
  ],
};

const CLOSING_ITEMS: CreditItem[] = [
  {
    kind: 'gag',
    id: 'gag-greetz',
    roleKey: 'supporters.credits.gag.greetzRole',
    valueKey: 'supporters.credits.gag.greetzValue',
  },
  {
    kind: 'gag',
    id: 'gag-developer',
    roleKey: 'supporters.credits.gag.developerRole',
    valueKey: 'supporters.credits.gag.developerValue',
  },
  { kind: 'note', id: 'note-harmed', textKey: 'supporters.credits.gag.noBinsHarmed' },
];

/** FNV-1a, so the bundled fallback (which carries no departments) still spreads out. */
export function fallbackDepartment(name: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % SUPPORTER_DEPARTMENT_COUNT;
}

export function departmentOf(bin: SupporterBin): number {
  if (bin.name === null) return REDACTED_DEPARTMENT;
  return isSupporterDepartment(bin.department) ? bin.department : fallbackDepartment(bin.name);
}

function isSomebody(bin: SupporterBin): boolean {
  return bin.name === KOFI_DEFAULT_NAME;
}

/**
 * Lay out the roll: each department's heading, its plain names in one grid,
 * then its message lines. Supporters named "Somebody" roll together in a
 * section of their own before the redacted department, but keep their seats
 * in their own department's zone, so the plate looks the same either way.
 * Bins keep the order they arrive in, which is the per-load shuffle from
 * `buildSupporterBins`.
 */
export function buildCreditsPlan(bins: SupporterBin[]): CreditsPlan {
  const members: SupporterBin[][] = Array.from({ length: DEPARTMENT_TITLE_KEYS.length }, () => []);
  for (const bin of bins) members[departmentOf(bin)].push(bin);

  const items: CreditItem[] = [];
  const seats = new Map<string, CreditSeat>();
  const nextSlot = members.map(() => 0);
  const seat = (bin: SupporterBin) => {
    const zone = departmentOf(bin);
    seats.set(bin.id, { zone, slot: nextSlot[zone]++ });
  };
  const creditNames = (group: SupporterBin[], id: string) => {
    if (group.length === 0) return;
    group.forEach(seat);
    items.push({ kind: 'names', id, binIds: group.map((b) => b.id) });
  };
  const creditMessages = (group: SupporterBin[]) => {
    for (const bin of group.filter((b) => b.message)) {
      seat(bin);
      items.push({ kind: 'message', id: `message-${bin.id}`, binId: bin.id });
    }
  };

  const creditDepartment = (zone: number) => {
    const group = members[zone].filter((b) => !isSomebody(b));
    if (group.length > 0) {
      items.push({ kind: 'department', id: `dept-${zone}`, department: zone });
      creditNames(
        group.filter((b) => !b.message),
        `names-${zone}`
      );
      creditMessages(group);
    }
    items.push(...(GAGS_AFTER[zone] ?? []));
  };

  for (let zone = 0; zone < REDACTED_DEPARTMENT; zone++) creditDepartment(zone);

  const somebodies = bins.filter(isSomebody);
  if (somebodies.length > 0) {
    items.push({
      kind: 'section',
      id: 'section-somebody',
      titleKey: 'supporters.credits.somebody.title',
      noteKey: 'supporters.credits.somebody.note',
    });
    // The newest keeps a line of their own, so "just joined" names one person.
    const quiet = somebodies.filter((b) => !b.message && !b.isNewest);
    if (quiet.length > 1) {
      quiet.forEach(seat);
      items.push({ kind: 'crowd', id: 'crowd-somebody', binIds: quiet.map((b) => b.id) });
    } else {
      creditNames(quiet, 'names-somebody');
    }
    creditNames(
      somebodies.filter((b) => !b.message && b.isNewest),
      'names-somebody-newest'
    );
    creditMessages(somebodies);
  }

  creditDepartment(REDACTED_DEPARTMENT);
  items.push(...CLOSING_ITEMS);

  return { items, seats, zoneSizes: members.map((g) => g.length) };
}
