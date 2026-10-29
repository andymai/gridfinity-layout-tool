import { describe, expect, it } from 'vitest';
import {
  DEPARTMENT_TITLE_KEYS,
  KOFI_DEFAULT_NAME,
  REDACTED_DEPARTMENT,
  buildCreditsPlan,
  departmentOf,
  fallbackDepartment,
  type CreditItem,
} from './creditsPlan';
import type { SupporterBin } from './supportersData';

const bin = (id: string, over: Partial<SupporterBin> = {}): SupporterBin => ({
  id,
  name: id,
  isNewest: false,
  ...over,
});

const kinds = (items: CreditItem[]) =>
  items.map((i) => (i.kind === 'department' ? `dept-${i.department}` : i.kind));

describe('departmentOf', () => {
  it('uses the server department when it has one', () => {
    expect(departmentOf(bin('a', { department: 5 }))).toBe(5);
  });

  it('puts every anonymous supporter in the redacted department', () => {
    expect(departmentOf(bin('a', { name: null, department: 2 }))).toBe(REDACTED_DEPARTMENT);
  });

  it('hashes the name when the list carries no department', () => {
    expect(departmentOf(bin('Ada'))).toBe(fallbackDepartment('Ada'));
  });
});

describe('fallbackDepartment', () => {
  it('spreads names across every department', () => {
    const hit = new Set<number>();
    for (let i = 0; i < 200; i++) hit.add(fallbackDepartment(`Supporter ${i}`));
    expect(hit.size).toBe(REDACTED_DEPARTMENT);
  });
});

describe('buildCreditsPlan', () => {
  it('rolls departments in order with the redacted one last', () => {
    const plan = buildCreditsPlan([
      bin('anon', { name: null }),
      bin('c', { department: 7 }),
      bin('a', { department: 0 }),
    ]);
    const headings = plan.items.flatMap((i) => (i.kind === 'department' ? [i.department] : []));
    expect(headings).toEqual([0, 7, REDACTED_DEPARTMENT]);
  });

  it('skips the heading of a department nobody is in', () => {
    const plan = buildCreditsPlan([bin('a', { department: 3 })]);
    expect(plan.items.filter((i) => i.kind === 'department')).toHaveLength(1);
  });

  it('credits a department as its heading, one grid of names, then its quotes', () => {
    const plan = buildCreditsPlan([
      bin('m1', { department: 0, message: 'one' }),
      bin('p1', { department: 0 }),
      bin('m2', { department: 0, message: 'two' }),
      ...['p2', 'p3', 'p4', 'p5', 'p6'].map((id) => bin(id, { department: 0 })),
    ]);
    const dept = kinds(plan.items).slice(0, kinds(plan.items).indexOf('gag'));
    expect(dept).toEqual(['dept-0', 'names', 'message', 'message']);
    const names = plan.items.find((i) => i.kind === 'names');
    expect(names?.kind === 'names' && names.binIds).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
  });

  describe('supporters named Somebody', () => {
    const somebody = (id: string, over: Partial<SupporterBin> = {}) =>
      bin(id, { name: KOFI_DEFAULT_NAME, ...over });
    const plan = buildCreditsPlan([
      somebody('s1', { department: 0 }),
      bin('a', { department: 0 }),
      somebody('s2', { department: 3 }),
      somebody('s3', { department: 0, message: 'thanks!' }),
      bin('anon', { name: null }),
      somebody('s4', { department: 3 }),
    ]);

    it('roll together on one line in a section before the redacted department', () => {
      const ids = plan.items.map((i) => i.id);
      expect(ids.indexOf('section-somebody')).toBeGreaterThan(ids.indexOf('dept-0'));
      expect(ids.indexOf('section-somebody')).toBeLessThan(
        ids.indexOf(`dept-${REDACTED_DEPARTMENT}`)
      );
      const crowd = plan.items.find((i) => i.kind === 'crowd');
      expect(crowd?.kind === 'crowd' && crowd.binIds).toEqual(['s1', 's2', 's4']);
      expect(ids).toContain('message-s3');
      expect(ids).not.toContain('dept-3');
    });

    it('keep their seats in their own department, after its named members', () => {
      expect(plan.seats.get('a')).toEqual({ zone: 0, slot: 0 });
      expect(plan.seats.get('s1')).toEqual({ zone: 0, slot: 1 });
      expect(plan.seats.get('s3')).toEqual({ zone: 0, slot: 2 });
      expect(plan.seats.get('s2')).toEqual({ zone: 3, slot: 0 });
      expect(plan.zoneSizes[0]).toBe(3);
      expect(plan.zoneSizes[3]).toBe(2);
    });

    it('give the newest Somebody a line of their own, so "just joined" names one person', () => {
      const withNewest = buildCreditsPlan([
        somebody('s1', { department: 0 }),
        somebody('s2', { department: 1 }),
        somebody('s3', { department: 2, isNewest: true }),
      ]);
      const crowd = withNewest.items.find((i) => i.kind === 'crowd');
      expect(crowd?.kind === 'crowd' && crowd.binIds).toEqual(['s1', 's2']);
      expect(withNewest.items.map((i) => i.id)).toContain('names-somebody-newest');
    });

    it('credit a lone Somebody as a plain name', () => {
      const lone = buildCreditsPlan([somebody('s1', { department: 0 })]);
      expect(kinds(lone.items)).not.toContain('crowd');
      expect(lone.items.map((i) => i.id)).toContain('names-somebody');
    });
  });

  it('credits every supporter exactly once, and seats them in roll order', () => {
    const bins = Array.from({ length: 40 }, (_, i) =>
      bin(`b${i}`, {
        name: i % 7 === 0 ? null : i % 5 === 0 ? KOFI_DEFAULT_NAME : `b${i}`,
        department: i % 8,
        message: i % 3 === 0 && i % 7 !== 0 ? 'thanks' : undefined,
      })
    );
    const plan = buildCreditsPlan(bins);
    const credited = plan.items.flatMap((i) =>
      i.kind === 'names' || i.kind === 'crowd' ? i.binIds : i.kind === 'message' ? [i.binId] : []
    );
    expect([...credited].sort()).toEqual(bins.map((b) => b.id).sort());

    for (let zone = 0; zone < DEPARTMENT_TITLE_KEYS.length; zone++) {
      const slots = credited
        .map((id) => plan.seats.get(id))
        .filter((s) => s?.zone === zone)
        .map((s) => s?.slot);
      expect(slots).toEqual([...slots].sort((a = 0, b = 0) => a - b));
      expect(slots).toHaveLength(plan.zoneSizes[zone]);
    }
  });

  it('places the gag credits and closes with the developer and the disclaimer', () => {
    const plan = buildCreditsPlan([bin('a', { department: 0 }), bin('b', { department: 6 })]);
    const ids = plan.items.map((i) => i.id);
    expect(ids.indexOf('gag-catering')).toBeLessThan(ids.indexOf('gag-magnet-retrieval'));
    expect(ids.indexOf('gag-magnet-retrieval')).toBeLessThan(ids.indexOf('gag-continuity'));
    expect(ids.indexOf('gag-continuity')).toBeLessThan(ids.indexOf('dept-6'));
    expect(ids.slice(-3)).toEqual(['gag-greetz', 'gag-developer', 'note-harmed']);
  });

  it('still produces the closing credits for an empty list', () => {
    expect(buildCreditsPlan([]).items.map((i) => i.id)).toContain('note-harmed');
  });
});
