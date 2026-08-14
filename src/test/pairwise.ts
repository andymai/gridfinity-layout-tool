/**
 * All-pairs (pairwise) case generation for combinatorial test matrices.
 *
 * A full product over the axes that can reach a lid's seating band is in the
 * thousands of WASM builds; a hand-picked list is the enumerate-by-hand model
 * that lets defects through in the first place. All-pairs is the standard
 * middle: every VALUE PAIR from every AXIS PAIR appears in at least one case,
 * which is where interaction defects overwhelmingly live, for a case count
 * near the product of the two largest axes rather than of all of them.
 *
 * Greedy IPOG-style horizontal-then-vertical growth. Deterministic — no
 * randomness, so the same axes always yield the same cases in the same order
 * and a failure is reproducible from the case index alone.
 */

/** One axis: a name and its possible values. */
export interface Axis<T> {
  readonly name: string;
  readonly values: readonly T[];
}

/** A generated case: one value per axis, keyed by axis name. */
export type PairwiseCase<T> = Readonly<Record<string, T>>;

function pairKey(a: string, ai: number, b: string, bi: number): string {
  return `${a}=${ai}|${b}=${bi}`;
}

/** Every value pair across every axis pair, as lookup keys. */
function allPairKeys<T>(axes: readonly Axis<T>[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < axes.length; i++) {
    for (let j = i + 1; j < axes.length; j++) {
      for (let ai = 0; ai < axes[i].values.length; ai++) {
        for (let bi = 0; bi < axes[j].values.length; bi++) {
          out.add(pairKey(axes[i].name, ai, axes[j].name, bi));
        }
      }
    }
  }
  return out;
}

/** Pairs a partial case (axis name → value index) covers among `axes`. */
function coveredBy(chosen: ReadonlyMap<string, number>, axes: readonly Axis<unknown>[]): string[] {
  const names = axes.map((a) => a.name).filter((n) => chosen.has(n));
  const out: string[] = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      // Axis order in the key must match `allPairKeys`, which walks the axis
      // array in order — not the insertion order of `chosen`.
      const [a, b] =
        axes.findIndex((x) => x.name === names[i]) < axes.findIndex((x) => x.name === names[j])
          ? [names[i], names[j]]
          : [names[j], names[i]];
      out.push(pairKey(a, chosen.get(a) ?? 0, b, chosen.get(b) ?? 0));
    }
  }
  return out;
}

/**
 * Generate a pairwise-complete set of cases.
 *
 * Axes are consumed in the order given; put the largest first, since the case
 * count is bounded below by the product of the two largest. Axes with a single
 * value are constants and contribute no pairs, but still appear in each case.
 *
 * The result is pairwise-complete by construction, and
 * {@link uncoveredPairs} proves it — the matrix test asserts that rather than
 * trusting this comment.
 */
export function allPairs<T>(axes: readonly Axis<T>[]): PairwiseCase<T>[] {
  if (axes.length === 0) return [];
  if (axes.length === 1) {
    return axes[0].values.map((v) => ({ [axes[0].name]: v }));
  }

  const remaining = allPairKeys(axes);
  // Seed with the full product of the first two axes.
  const cases: Array<Map<string, number>> = [];
  for (let a = 0; a < axes[0].values.length; a++) {
    for (let b = 0; b < axes[1].values.length; b++) {
      const c = new Map([
        [axes[0].name, a],
        [axes[1].name, b],
      ]);
      for (const k of coveredBy(c, axes)) remaining.delete(k);
      cases.push(c);
    }
  }

  for (let k = 2; k < axes.length; k++) {
    const axis = axes[k];
    const grown = axes.slice(0, k + 1);

    // Horizontal growth: extend each existing case with the value that covers
    // the most still-uncovered pairs.
    for (const c of cases) {
      let best = 0;
      let bestGain: string[] = [];
      for (let v = 0; v < axis.values.length; v++) {
        const trial = new Map(c).set(axis.name, v);
        const gain = coveredBy(trial, grown).filter((p) => remaining.has(p));
        if (gain.length > bestGain.length || bestGain.length === 0) {
          best = v;
          bestGain = gain;
        }
      }
      c.set(axis.name, best);
      for (const p of coveredBy(c, grown)) remaining.delete(p);
    }

    // Vertical growth: any pair this axis still owes gets its own case, with
    // the other axes filled from their first value.
    for (let v = 0; v < axis.values.length; v++) {
      for (let prior = 0; prior < k; prior++) {
        const other = axes[prior];
        for (let ov = 0; ov < other.values.length; ov++) {
          // `other` precedes `axis` in the array, so this key orientation
          // matches the one `allPairKeys` produced.
          if (!remaining.has(pairKey(other.name, ov, axis.name, v))) continue;
          const c = new Map<string, number>();
          for (const a of grown) c.set(a.name, 0);
          c.set(other.name, ov);
          c.set(axis.name, v);
          for (const p of coveredBy(c, grown)) remaining.delete(p);
          cases.push(c);
        }
      }
    }
  }

  return cases.map((c) => {
    const out: Record<string, T> = {};
    for (const axis of axes) out[axis.name] = axis.values[c.get(axis.name) ?? 0];
    return out;
  });
}

/**
 * Value pairs the case set fails to cover. Empty means pairwise-complete.
 *
 * Exported so a matrix test can assert the property rather than assume it: a
 * generator bug that silently dropped pairs would shrink the matrix and look
 * like a speed-up.
 */
export function uncoveredPairs<T>(
  axes: readonly Axis<T>[],
  cases: readonly PairwiseCase<T>[]
): string[] {
  const remaining = allPairKeys(axes);
  const indexOf = new Map<string, Map<T, number>>();
  for (const axis of axes) {
    indexOf.set(axis.name, new Map(axis.values.map((v, i) => [v, i])));
  }
  for (const c of cases) {
    const chosen = new Map<string, number>();
    for (const axis of axes) {
      chosen.set(axis.name, indexOf.get(axis.name)?.get(c[axis.name]) ?? 0);
    }
    for (const p of coveredBy(chosen, axes)) remaining.delete(p);
  }
  return [...remaining].sort();
}
