/**
 * Compile-time assertion that a key manifest and its TypeScript type agree.
 *
 * Used by every manifest in this directory. A disagreement in either direction
 * resolves to an object type naming the offending keys, which {@link Assert}
 * then rejects with those keys in the error message, so `pnpm run typecheck`
 * points straight at the field that was added or removed.
 */
export type KeysMatch<Actual extends PropertyKey, Listed extends PropertyKey> = [
  Exclude<Actual, Listed>,
] extends [never]
  ? [Exclude<Listed, Actual>] extends [never]
    ? true
    : { manifestListsKeysTheTypeDoesNotHave: Exclude<Listed, Actual> }
  : { typeHasKeysTheManifestDoesNotList: Exclude<Actual, Listed> };

export type Assert<T extends true> = T;
