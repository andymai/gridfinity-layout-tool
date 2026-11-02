import { describe, it, expect } from 'vitest';
import { writeDxf } from './dxfWriter';

const triangle = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: -0.0000001, y: 5 },
];

/** The DXF as [code, value] pairs. */
function groups(dxf: string): [number, string][] {
  const lines = dxf.trimEnd().split('\n');
  const out: [number, string][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) out.push([Number(lines[i]), lines[i + 1]]);
  return out;
}

describe('writeDxf', () => {
  const dxf = writeDxf([{ name: 'CUTS', color: 7, rings: [triangle] }], ['Made for a test.']);
  const pairs = groups(dxf);

  it('opens with its comment and declares R12 in millimetres', () => {
    expect(pairs[0]).toEqual([999, 'Made for a test.']);
    const at = pairs.findIndex(([c, v]) => c === 9 && v === '$INSUNITS');
    expect(pairs[at + 1]).toEqual([70, '4']);
    expect(pairs.find(([c, v]) => c === 1 && v.startsWith('AC'))).toEqual([1, 'AC1009']);
  });

  it('writes each ring as one closed polyline of its points', () => {
    const start = pairs.findIndex(([c, v]) => c === 0 && v === 'POLYLINE');
    expect(pairs.slice(start, start + 8)).toContainEqual([70, '1']);
    expect(pairs.filter(([c, v]) => c === 0 && v === 'VERTEX')).toHaveLength(3);
    expect(pairs.filter(([c, v]) => c === 0 && v === 'SEQEND')).toHaveLength(1);
  });

  it('declares every layer it uses, and ends the file', () => {
    expect(pairs).toContainEqual([2, 'CUTS']);
    expect(pairs.at(-1)).toEqual([0, 'EOF']);
  });

  it('writes six decimals and never a negative zero', () => {
    expect(dxf).toContain('10\n10.000000\n');
    expect(dxf).not.toMatch(/-0\.000000/);
  });

  it('skips rings too short to close', () => {
    const empty = writeDxf([{ name: 'CUTS', color: 7, rings: [triangle.slice(0, 2)] }]);
    expect(empty).not.toContain('POLYLINE');
  });
});
