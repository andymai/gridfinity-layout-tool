import { describe, expect, it } from 'vitest';
import {
  DEPARTMENT_TITLE_KEYS,
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

  it('spreads message lines between name blocks instead of bunching them', () => {
    const plan = buildCreditsPlan([
      bin('m1', { department: 0, message: 'one' }),
      bin('m2', { department: 0, message: 'two' }),
      ...['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((id) => bin(id, { department: 0 })),
    ]);
    const dept = kinds(plan.items).slice(0, kinds(plan.items).indexOf('gag'));
    expect(dept).toEqual(['dept-0', 'names', 'message', 'names', 'message', 'names']);
  });

  it('credits every supporter exactly once, and seats them in roll order', () => {
    const bins = Array.from({ length: 40 }, (_, i) =>
      bin(`b${i}`, {
        name: i % 7 === 0 ? null : `b${i}`,
        department: i % 8,
        message: i % 3 === 0 && i % 7 !== 0 ? 'thanks' : undefined,
      })
    );
    const plan = buildCreditsPlan(bins);
    const credited = plan.items.flatMap((i) =>
      i.kind === 'names' ? i.binIds : i.kind === 'message' ? [i.binId] : []
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
    expect(ids.indexOf('gag-catering')).toBeLessThan(ids.indexOf('gag-continuity'));
    expect(ids.indexOf('gag-continuity')).toBeLessThan(ids.indexOf('dept-6'));
    expect(ids.slice(-3)).toEqual(['gag-greetz', 'gag-developer', 'note-harmed']);
  });

  it('still produces the closing credits for an empty list', () => {
    expect(buildCreditsPlan([]).items.map((i) => i.id)).toContain('note-harmed');
  });
});
