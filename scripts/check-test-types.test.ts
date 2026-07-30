import { describe, it, expect } from 'vitest';
import {
  parseDiagnostics,
  diffAgainstBaseline,
  hasDrift,
  readBaseline,
  classifyRun,
} from './check-test-types';

describe('parseDiagnostics', () => {
  it('counts one diagnostic per error line', () => {
    const output = [
      'src/a.test.ts(10,5): error TS2322: Type A is not assignable to type B.',
      'src/a.test.ts(11,5): error TS2339: Property x does not exist.',
      'src/b.test.ts(1,1): error TS2304: Cannot find name Foo.',
    ].join('\n');
    expect(parseDiagnostics(output)).toEqual({ 'src/a.test.ts': 2, 'src/b.test.ts': 1 });
  });

  it('does not count indented elaboration lines as separate errors', () => {
    const output = [
      "src/a.test.ts(10,5): error TS2322: Type 'number' is not assignable to type 'GridUnits'.",
      "  Type 'number' is not assignable to type '{ readonly __brand: \"GridUnits\"; }'.",
    ].join('\n');
    expect(parseDiagnostics(output)).toEqual({ 'src/a.test.ts': 1 });
  });

  it('normalizes Windows path separators', () => {
    const output = 'src\\features\\a.test.ts(1,1): error TS2304: Cannot find name Foo.';
    expect(parseDiagnostics(output)).toEqual({ 'src/features/a.test.ts': 1 });
  });

  it('returns an empty map for clean output', () => {
    expect(parseDiagnostics('')).toEqual({});
  });

  it('ignores summary lines that mention errors without the diagnostic shape', () => {
    expect(parseDiagnostics('Found 3 errors in 2 files.')).toEqual({});
  });
});

describe('classifyRun', () => {
  it('treats a non-zero exit with diagnostics as a real run', () => {
    const run = classifyRun({
      status: 2,
      stdout: 'src/a.test.ts(1,1): error TS2304: Cannot find name Foo.',
      stderr: '',
    });
    expect(run.spawnFailure).toBeNull();
    expect(parseDiagnostics(run.output)).toEqual({ 'src/a.test.ts': 1 });
  });

  it('treats a missing binary as a failure to run, not as a clean compile', () => {
    const run = classifyRun({ code: 'ENOENT', message: 'spawn tsgo ENOENT' });
    expect(run.spawnFailure).toBe('spawn tsgo ENOENT');
  });

  it('falls back to a message when the thrown error carries none', () => {
    expect(classifyRun({}).spawnFailure).toBe('tsgo could not be started');
  });

  it('treats a null status as a failure to run', () => {
    // Killed by a signal — no exit status, so no diagnostics can be trusted.
    expect(classifyRun({ status: null, message: 'killed' }).spawnFailure).toBe('killed');
  });
});

describe('readBaseline', () => {
  it('accepts a well-formed baseline', () => {
    const raw = JSON.stringify({ note: 'x', total: 3, files: { 'a.test.ts': 3 } });
    expect(readBaseline(raw)?.files).toEqual({ 'a.test.ts': 3 });
  });

  it('rejects malformed JSON rather than throwing', () => {
    expect(readBaseline('{ not json')).toBeNull();
  });

  it('rejects a baseline missing the total', () => {
    expect(readBaseline(JSON.stringify({ files: {} }))).toBeNull();
  });

  it('rejects non-numeric file counts, which would silently disable the ratchet', () => {
    expect(readBaseline(JSON.stringify({ total: 1, files: { 'a.test.ts': 'lots' } }))).toBeNull();
  });

  it('rejects a JSON scalar', () => {
    expect(readBaseline('42')).toBeNull();
    expect(readBaseline('null')).toBeNull();
  });
});

describe('diffAgainstBaseline', () => {
  it('reports no drift when counts match exactly', () => {
    const drift = diffAgainstBaseline({ 'a.test.ts': 3 }, { 'a.test.ts': 3 });
    expect(hasDrift(drift)).toBe(false);
  });

  it('flags a file whose count grew', () => {
    const drift = diffAgainstBaseline({ 'a.test.ts': 3 }, { 'a.test.ts': 5 });
    expect(drift.regressed).toEqual([{ file: 'a.test.ts', from: 3, to: 5 }]);
    expect(hasDrift(drift)).toBe(true);
  });

  it('flags a file absent from the baseline', () => {
    const drift = diffAgainstBaseline({}, { 'new.test.ts': 1 });
    expect(drift.appeared).toEqual([{ file: 'new.test.ts', to: 1 }]);
    expect(hasDrift(drift)).toBe(true);
  });

  it('flags improvements so the baseline gets tightened rather than drifting stale', () => {
    const drift = diffAgainstBaseline({ 'a.test.ts': 5 }, { 'a.test.ts': 2 });
    expect(drift.improved).toEqual([{ file: 'a.test.ts', from: 5, to: 2 }]);
    expect(hasDrift(drift)).toBe(true);
  });

  it('flags a file that went fully clean', () => {
    const drift = diffAgainstBaseline({ 'a.test.ts': 5 }, {});
    expect(drift.cleared).toEqual([{ file: 'a.test.ts', from: 5 }]);
    expect(hasDrift(drift)).toBe(true);
  });

  it('separates a regression from an improvement in the same run', () => {
    const drift = diffAgainstBaseline(
      { 'a.test.ts': 5, 'b.test.ts': 2 },
      { 'a.test.ts': 1, 'b.test.ts': 9 }
    );
    expect(drift.improved).toEqual([{ file: 'a.test.ts', from: 5, to: 1 }]);
    expect(drift.regressed).toEqual([{ file: 'b.test.ts', from: 2, to: 9 }]);
  });
});
