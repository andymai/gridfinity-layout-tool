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
  'supporters.credits.dept.elephantsFoot',
  'supporters.credits.dept.almostFit',
  'supporters.credits.dept.lipQa',
  'supporters.credits.dept.redacted',
] as const;

export const DEPARTMENT_NOTE_KEYS: Partial<Record<number, string>> = {
  2: 'supporters.credits.dept.magnetHolesNote',
};

export type CreditItem =
  | { kind: 'department'; id: string; department: number }
  | { kind: 'names'; id: string; binIds: string[] }
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

/** Split `list` into `parts` runs whose lengths differ by at most one. */
function splitEvenly<T>(list: T[], parts: number): T[][] {
  const runs: T[][] = [];
  let start = 0;
  for (let i = 0; i < parts; i++) {
    const size = Math.floor(list.length / parts) + (i < list.length % parts ? 1 : 0);
    runs.push(list.slice(start, start + size));
    start += size;
  }
  return runs;
}

/**
 * Lay out the roll: each department's heading, then its plain names in short
 * blocks with every message line spread evenly between them, so a department
 * never ends in a wall of quotes. Bins keep the order they arrive in, which is
 * the per-load shuffle from `buildSupporterBins`.
 */
export function buildCreditsPlan(bins: SupporterBin[]): CreditsPlan {
  const members: SupporterBin[][] = Array.from({ length: DEPARTMENT_TITLE_KEYS.length }, () => []);
  for (const bin of bins) members[departmentOf(bin)].push(bin);

  const items: CreditItem[] = [];
  const seats = new Map<string, CreditSeat>();

  members.forEach((group, zone) => {
    if (group.length > 0) {
      items.push({ kind: 'department', id: `dept-${zone}`, department: zone });
      let slot = 0;
      const seat = (bin: SupporterBin) => seats.set(bin.id, { zone, slot: slot++ });

      const quoted = group.filter((b) => b.message);
      const plain = group.filter((b) => !b.message);
      splitEvenly(plain, quoted.length + 1).forEach((run, i) => {
        if (run.length > 0) {
          run.forEach(seat);
          items.push({ kind: 'names', id: `names-${zone}-${i}`, binIds: run.map((b) => b.id) });
        }
        const quote = quoted.at(i);
        if (quote) {
          seat(quote);
          items.push({ kind: 'message', id: `message-${quote.id}`, binId: quote.id });
        }
      });
    }
    items.push(...(GAGS_AFTER[zone] ?? []));
  });
  items.push(...CLOSING_ITEMS);

  return { items, seats, zoneSizes: members.map((g) => g.length) };
}
