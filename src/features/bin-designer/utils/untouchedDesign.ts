import { paramsFingerprint } from '@/shared/generation/paramsFingerprint';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { BinParams } from '../types';

/**
 * Settings and the owning layout write these into a design nobody edited, so
 * they say nothing about work. Every other field does, including fields added
 * after this list, which a list of edited fields would miss.
 */
const WRITTEN_FOR_THE_USER = [
  'nozzleSizeMm',
  'magnetAnchor',
] as const satisfies readonly (keyof BinParams)[];

const IGNORED: ReadonlySet<string> = new Set(WRITTEN_FOR_THE_USER);

function partOf(params: BinParams): Record<string, unknown> {
  return {
    ...Object.fromEntries(Object.entries(params).filter(([field]) => !IGNORED.has(field))),
    base: { ...params.base, lowProfile: undefined },
  };
}

let defaultPart: string | null = null;

/** True for the "Untitled Bin" a first designer visit saves, until someone edits it. */
export function isUntouchedDefault(params: BinParams): boolean {
  defaultPart ??= paramsFingerprint(partOf(DEFAULT_BIN_PARAMS));
  return paramsFingerprint(partOf(params)) === defaultPart;
}
