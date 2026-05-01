/**
 * Type-inference tests for the v2 foundations. Validates that
 * `defineCommand({...})` plus `createRegistry([...])` plus
 * `Mutations<typeof registry>` thread types end-to-end without collapsing
 * to `unknown`, `never`, or `any`. expectTypeOf assertions run at
 * typecheck time; the runtime smoke test below ensures vitest discovers
 * the file.
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import type { Result, ValidationError, LayoutError } from '@/core/result';
import { sampleAddBin, sampleDeleteBin, sampleRegistry } from './sample';
import { createRegistry } from './createRegistry';
import type { Mutations, PayloadOf, ValueOf, ErrorOf } from './Mutations';

describe('v2 type inference', () => {
  describe('defineCommand captures literal types', () => {
    it('infers `type` as a string literal, not widened string', () => {
      expectTypeOf(sampleAddBin.type).toEqualTypeOf<'sample.bin.add'>();
      expectTypeOf(sampleDeleteBin.type).toEqualTypeOf<'sample.bin.delete'>();
    });

    it('infers `aggregate` as the literal name', () => {
      expectTypeOf(sampleAddBin.aggregate).toEqualTypeOf<'layout'>();
    });

    it('infers `emitted` as the literal event type string', () => {
      expectTypeOf(sampleAddBin.emitted).toEqualTypeOf<'sample.bin.added'>();
    });
  });

  describe('PayloadOf / ValueOf / ErrorOf extractors', () => {
    it('extracts payload from defineCommand return', () => {
      expectTypeOf<PayloadOf<typeof sampleAddBin>>().toEqualTypeOf<{
        layerId: string;
        x: number;
        y: number;
      }>();
    });

    it('extracts value type from handle return', () => {
      expectTypeOf<ValueOf<typeof sampleAddBin>>().toEqualTypeOf<'bin_123'>();
      expectTypeOf<ValueOf<typeof sampleDeleteBin>>().toEqualTypeOf<undefined>();
    });

    it('extracts error union from handle return', () => {
      expectTypeOf<ErrorOf<typeof sampleAddBin>>().toEqualTypeOf<ValidationError>();
      expectTypeOf<ErrorOf<typeof sampleDeleteBin>>().toEqualTypeOf<LayoutError>();
    });
  });

  describe('Mutations<R> derived from registry', () => {
    type M = Mutations<typeof sampleRegistry>;

    it('exposes one method per command, keyed by command type', () => {
      expectTypeOf<keyof M>().toEqualTypeOf<'sample.bin.add' | 'sample.bin.delete'>();
    });

    it('infers payload type per method', () => {
      expectTypeOf<Parameters<M['sample.bin.add']>[0]>().toEqualTypeOf<{
        layerId: string;
        x: number;
        y: number;
      }>();
      expectTypeOf<Parameters<M['sample.bin.delete']>[0]>().toEqualTypeOf<{ id: string }>();
    });

    it('infers Result<value, error> per method', () => {
      expectTypeOf<ReturnType<M['sample.bin.add']>>().toEqualTypeOf<
        Result<'bin_123', ValidationError>
      >();
      expectTypeOf<ReturnType<M['sample.bin.delete']>>().toEqualTypeOf<
        Result<undefined, LayoutError>
      >();
    });
  });

  describe('Registry preserves byType lookup', () => {
    it('preserves the full command def under byType[K]', () => {
      expectTypeOf(sampleRegistry.byType['sample.bin.add']).toEqualTypeOf<typeof sampleAddBin>();
    });
  });
});

describe('v2 registry runtime', () => {
  it('contains both sample commands', () => {
    expect(sampleRegistry.commands).toHaveLength(2);
  });

  it('throws when two commands declare the same type', () => {
    expect(() =>
      createRegistry([sampleAddBin, sampleAddBin] as const)
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: createRegistry: duplicate command type "sample.bin.add" — every command must register a unique type]`
    );
  });
});
