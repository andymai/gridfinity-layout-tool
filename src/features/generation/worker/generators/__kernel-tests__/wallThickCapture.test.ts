// @vitest-environment node
/**
 * Diagnostic (not a CI gate): capture the operands of every `fuse` the
 * wallThickness=3.8 bin export performs, so the failing one ("open hole shell
 * with 9 faces", 12x identical) can be replayed natively in brepkit at
 * millisecond speed instead of through a 3-second tool export.
 *
 * Wraps the raw brepkit kernel's `fuse` and serializes both operands with
 * `serializeSolid` before each call. Replay with `replay_cut_capture`-style
 * loaders on the brepkit side.
 */
import { describe, it, beforeAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { initBrepjs } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { clearAllCaches, setLastSolid } from '../shapeCache';
import { getKernel } from 'brepjs';

const OUT = process.env.CAP_OUT ?? '/tmp/wallthick-capture';
const WALL = Number(process.env.WALL ?? '3.8');

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

describe('wall-thickness fuse capture', () => {
  it('serializes every fuse operand pair', async () => {
    mkdirSync(OUT, { recursive: true });

    const bk = (getKernel() as any).bk as {
      fuse: (a: number, b: number) => number;
      serializeSolid: (id: number) => Uint8Array;
    };
    let n = 0;
    const index: string[] = [];
    // The tool's export drives the PROVENANCE entries, so a plain `fuse` hook
    // never fires (measured: 0 calls). Wrap every boolean entry point.
    for (const name of [
      'fuse',
      'cut',
      'intersect',
      'fuseWithEvolution',
      'cutWithEvolution',
      'intersectWithEvolution',
      'fuseAll',
      'compoundCut',
    ]) {
      const anyBk = bk as any;
      if (typeof anyBk[name] !== 'function') continue;
      const orig = anyBk[name].bind(bk);
      anyBk[name] = (...args: unknown[]): unknown => {
        const i = n++;
        const ids = args.filter((x): x is number => typeof x === 'number');
        try {
          ids.forEach((id, k) => {
            writeFileSync(`${OUT}/op${i}-${name}-${k}.bin`, Buffer.from(bk.serializeSolid(id)));
          });
          index.push(`op${i} ${name} ids=${ids.join(',')}`);
        } catch (e) {
          index.push(`op${i} ${name} SERIALIZE_FAILED ${String(e)}`);
        }
        return orig(...args);
      };
    }

    clearAllCaches();
    setLastSolid(null);
    let err = '';
    try {
      const { exportBin } = await import('../binExporter');
      await exportBin(
        buildParams({
          width: 1,
          depth: 1,
          height: 10,
          base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
          wallThickness: WALL,
        }),
        'stl'
      );
    } catch (e) {
      err = String(e);
    }
    writeFileSync(
      `${OUT}/index.txt`,
      `wall=${WALL}\nfuses=${n}\nerror=${err}\n${index.join('\n')}\n`
    );
  }, 900_000);
});
