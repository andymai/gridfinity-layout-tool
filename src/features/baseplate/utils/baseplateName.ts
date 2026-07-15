import type { BaseplateRef } from '@/features/baseplate/store/baseplateRegistry';

/**
 * Next free "Baseplate N" name given the current library entries.
 *
 * Fills gaps rather than always appending, so deleting Baseplate 2 and creating
 * another reuses the number instead of drifting upward forever.
 */
export function nextBaseplateName(list: readonly BaseplateRef[]): string {
  const used = new Set(
    list
      .map((ref) => /^Baseplate (\d+)$/.exec(ref.name)?.[1])
      .filter((match): match is string => match !== undefined)
      .map((n) => Number.parseInt(n, 10))
  );
  let n = 1;
  while (used.has(n)) n += 1;
  return `Baseplate ${n}`;
}
