/**
 * Stage capture v2 for the mixed-detail per-cell half-sockets chain.
 *
 * Patches EVERY method on the raw brepkit kernel (minus serializers/readers),
 * serializing integer args and results that deserialize as solids, so the
 * native directed half-edge audit can attribute which op first emits
 * orientation mismatches (see brepkit crates/io/tests/topsocket_cut_inmem.rs).
 *
 * Run: BREPJS_KERNEL=brepkit ./node_modules/.bin/vitest run \
 *   --config vitest.profile.config.ts \
 *   src/features/generation/worker/generators/__kernel-tests__/mixedSocketStageCapture.test
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { initBrepjs, getGenerateBin } from './wasmInit';
import { getRawBrepkitKernel } from './dualKernelInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { CellMask } from '@/shared/utils/cellMask';

const OUT_DIR = '/tmp/mixed_socket_stages_v2';

const SKIP =
  /serialize|deserialize|import|export|mesh|tessellate|get|validate|free|constructor|delete|checkpoint|restore|dispose|setLog|classify|distance|volume|area|bounding/i;

function buildMask(rows: (0 | 1)[][]): CellMask {
  const bottomFirst = rows.slice().reverse();
  const cols = bottomFirst[0]?.length ?? 0;
  return { cols, rows: bottomFirst.length, cells: bottomFirst.flat() };
}

const MIXED_HALF_BIN_MASK: CellMask = buildMask([
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [1, 1, 1, 0],
]);

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

describe('mixed-socket stage capture v2', () => {
  it('captures every solid-producing stage of the mixed-detail chain', () => {
    mkdirSync(OUT_DIR, { recursive: true });
    const kernel = getRawBrepkitKernel() as unknown as Record<string, unknown>;
    const manifest: string[] = [];
    let callSeq = 0;
    let inHook = false;

    const trySerialize = (id: unknown, tag: string): void => {
      if (typeof id !== 'number' || !Number.isInteger(id)) return;
      try {
        const bytes = (kernel.serializeSolid as (n: number) => Uint8Array).call(kernel, id);
        writeFileSync(`${OUT_DIR}/${tag}.bin`, bytes);
        manifest.push(`${tag} solid=${id} bytes=${bytes.length}`);
      } catch {
        /* not a solid id */
      }
    };

    const patch = (name: string): void => {
      const orig = kernel[name];
      if (typeof orig !== 'function') return;
      kernel[name] = (...args: unknown[]) => {
        if (inHook) return (orig as (...a: unknown[]) => unknown).apply(kernel, args);
        const seq = callSeq++;
        inHook = true;
        try {
          const flat = args.flatMap((a) => (Array.isArray(a) ? a : [a]));
          flat.forEach((a, i) =>
            trySerialize(a, `${String(seq).padStart(3, '0')}_${name}_arg${i}`)
          );
          // Loft profiles are FACE ids (not serializable directly): extrude
          // each into a thin solid whose TOP cap carries the input profile
          // faithfully (extrude caps: bottom reversed, top forward).
          if (name.startsWith('loft') && Array.isArray(args[0])) {
            (args[0] as unknown[]).forEach((fid, i) => {
              if (typeof fid !== 'number') return;
              try {
                const sid = (
                  kernel.extrude as (
                    f: number,
                    x: number,
                    y: number,
                    z: number,
                    d: number
                  ) => number
                ).call(kernel, fid, 0, 0, 1, 0.5);
                trySerialize(sid, `${String(seq).padStart(3, '0')}_${name}_profile${i}`);
              } catch (e) {
                manifest.push(`profile extrude failed seq=${seq} i=${i}: ${String(e)}`);
              }
            });
            if (typeof args[1] === 'string') {
              writeFileSync(
                `${OUT_DIR}/${String(seq).padStart(3, '0')}_${name}_options.json`,
                args[1]
              );
            }
          }
        } finally {
          inHook = false;
        }
        const out = (orig as (...a: unknown[]) => unknown).apply(kernel, args);
        inHook = true;
        try {
          trySerialize(out, `${String(seq).padStart(3, '0')}_${name}_result`);
        } finally {
          inHook = false;
        }
        return out;
      };
    };

    const names = Object.getOwnPropertyNames(Object.getPrototypeOf(kernel)).filter(
      (n) => !SKIP.test(n)
    );
    for (const n of names) patch(n);
    manifest.push(`patched ${names.length}: ${names.join(', ')}`);

    const gen = getGenerateBin();
    const params = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      cellMask: MIXED_HALF_BIN_MASK,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, halfSockets: false },
    };
    const result = gen(params, undefined, true);
    manifest.push(`triangles=${result.triangleCount} calls=${callSeq}`);
    writeFileSync(`${OUT_DIR}/manifest.txt`, manifest.join('\n'));
    expect(result.triangleCount).toBeGreaterThan(0);
    expect(callSeq).toBeGreaterThan(0);
  }, 300_000);
});
