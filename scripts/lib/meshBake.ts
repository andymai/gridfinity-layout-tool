/** Pieces shared by the scripts that bake generated meshes into Draco GLBs. */

/**
 * Collapse the edge-segment soup: rebuild polyline chains from shared
 * endpoints, then Douglas-Peucker each chain. OCCT tessellates arcs far
 * denser than a page-scale render can show; this keeps corners exact
 * (junction points always survive) while dropping ~2/3 of the segments.
 */
export function simplifyEdgeLines(edgePositions: Float32Array, tolerance: number): Float32Array {
  const pointKey = (i: number): string =>
    `${Math.round(edgePositions[i] * 1e5)},${Math.round(edgePositions[i + 1] * 1e5)},${Math.round(
      edgePositions[i + 2] * 1e5
    )}`;

  const pointIds = new Map<string, number>();
  const points: number[] = [];
  const idAt = (offset: number): number => {
    const k = pointKey(offset);
    let id = pointIds.get(k);
    if (id === undefined) {
      id = points.length / 3;
      pointIds.set(k, id);
      points.push(edgePositions[offset], edgePositions[offset + 1], edgePositions[offset + 2]);
    }
    return id;
  };

  const segCount = edgePositions.length / 6;
  const segs: [number, number][] = [];
  const adjacency = new Map<number, number[]>();
  for (let s = 0; s < segCount; s++) {
    const a = idAt(s * 6);
    const b = idAt(s * 6 + 3);
    if (a === b) continue;
    const segIndex = segs.length;
    segs.push([a, b]);
    for (const id of [a, b]) {
      const list = adjacency.get(id);
      if (list) list.push(segIndex);
      else adjacency.set(id, [segIndex]);
    }
  }

  const used = new Array<boolean>(segs.length).fill(false);
  const chains: number[][] = [];
  const walk = (startSeg: number, startPoint: number): void => {
    const chain = [startPoint];
    let seg = startSeg;
    let point = startPoint;
    while (!used[seg]) {
      used[seg] = true;
      point = segs[seg][0] === point ? segs[seg][1] : segs[seg][0];
      chain.push(point);
      const next = (adjacency.get(point) ?? []).filter((s) => !used[s]);
      if ((adjacency.get(point) ?? []).length !== 2 || next.length !== 1) break;
      seg = next[0];
    }
    chains.push(chain);
  };
  // Open chains first (junctions/endpoints stay fixed), then leftover loops.
  for (const [point, segIndexes] of adjacency) {
    if (segIndexes.length === 2) continue;
    for (const seg of segIndexes) if (!used[seg]) walk(seg, point);
  }
  for (let s = 0; s < segs.length; s++) if (!used[s]) walk(s, segs[s][0]);

  const px = (id: number): [number, number, number] => [
    points[id * 3],
    points[id * 3 + 1],
    points[id * 3 + 2],
  ];
  const distToChord = (p: number, a: number, b: number): number => {
    const [pax, pay, paz] = px(a);
    const [pbx, pby, pbz] = px(b);
    const [ppx, ppy, ppz] = px(p);
    const abx = pbx - pax;
    const aby = pby - pay;
    const abz = pbz - paz;
    const apx = ppx - pax;
    const apy = ppy - pay;
    const apz = ppz - paz;
    const abLen2 = abx * abx + aby * aby + abz * abz;
    const t =
      abLen2 === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / abLen2));
    const dx = apx - t * abx;
    const dy = apy - t * aby;
    const dz = apz - t * abz;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };
  const douglasPeucker = (chain: number[], from: number, to: number, keep: Set<number>): void => {
    if (to - from < 2) return;
    let maxDist = 0;
    let maxIdx = from + 1;
    for (let i = from + 1; i < to; i++) {
      const d = distToChord(chain[i], chain[from], chain[to]);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    if (maxDist <= tolerance) return;
    keep.add(maxIdx);
    douglasPeucker(chain, from, maxIdx, keep);
    douglasPeucker(chain, maxIdx, to, keep);
  };

  const out: number[] = [];
  for (const chain of chains) {
    const keep = new Set<number>([0, chain.length - 1]);
    // Closed loops keep a midpoint so they can't collapse to a chord.
    if (chain[0] === chain[chain.length - 1] && chain.length > 2) {
      keep.add(Math.floor(chain.length / 2));
    }
    const anchors = [...keep].sort((x, y) => x - y);
    for (let i = 0; i < anchors.length - 1; i++) {
      douglasPeucker(chain, anchors[i], anchors[i + 1], keep);
    }
    const kept = [...keep].sort((x, y) => x - y);
    for (let i = 0; i < kept.length - 1; i++) {
      out.push(...px(chain[kept[i]]), ...px(chain[kept[i + 1]]));
    }
  }
  return new Float32Array(out);
}

export function bounds(positions: Float32Array): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      const v = positions[i + a];
      if (v < min[a]) min[a] = v;
      if (v > max[a]) max[a] = v;
    }
  }
  return { min, max };
}

export function pad4(buf: Buffer, fill: number): Buffer {
  const rem = buf.length % 4;
  return rem === 0 ? buf : Buffer.concat([buf, Buffer.alloc(4 - rem, fill)]);
}
