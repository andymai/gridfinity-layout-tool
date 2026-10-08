/**
 * Bumped whenever the signed-in account changes, so a request sent under an
 * earlier account can tell it no longer speaks for the current one.
 */
let generation = 0;

export function accountGeneration(): number {
  return generation;
}

export function onAccountChanged(): void {
  generation++;
}
