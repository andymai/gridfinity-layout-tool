/**
 * Probes for the attachment holes of an exported mesh: where each pocket
 * ceiling sits, and how much solid stands between a hole and the flank beside
 * it. Run them on the export mesh; the preview leaves overlapping shells that
 * break ray parity.
 */
import type { MeshData } from '@/features/generation/bridge/types';
import { columnCrossings } from './meshAssertions';

function lowestZ(mesh: MeshData): number {
  let minZ = Infinity;
  for (let i = 2; i < mesh.vertices.length; i += 3) minZ = Math.min(minZ, mesh.vertices[i]);
  return minZ;
}

/**
 * Centre of every pocket ceiling `ceilingDepth` above the underside, measured
 * rather than matched against candidates. Each pair of ceiling-height vertices
 * votes for the two centres of a `radius` circle through both; a ring's pairs
 * all agree on its centre, while the foot's own outline at that height
 * scatters its votes. The draft kernel draws a ring in ~20 vertices, so this
 * holds on every kernel.
 */
export function holeCentres(mesh: MeshData, radius: number, ceilingDepth: number): string[] {
  const ceilingZ = lowestZ(mesh) + ceilingDepth;
  const points: Array<[number, number]> = [];
  for (let i = 0; i < mesh.vertices.length; i += 3) {
    if (Math.abs(mesh.vertices[i + 2] - ceilingZ) > 0.02) continue;
    points.push([mesh.vertices[i], mesh.vertices[i + 1]]);
  }
  const bin = (v: number): number => Math.round(v * 20) / 20;
  const votes = new Map<string, { x: number; y: number; n: number }>();
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[j];
      const d = Math.hypot(bx - ax, by - ay);
      if (d < 0.2 || d > 2 * radius - 0.01) continue;
      const h = Math.sqrt(radius ** 2 - (d / 2) ** 2);
      for (const side of [-1, 1]) {
        const x = bin((ax + bx) / 2 - (side * h * (by - ay)) / d);
        const y = bin((ay + by) / 2 + (side * h * (bx - ax)) / d);
        const key = `${x},${y}`;
        const vote = votes.get(key) ?? { x, y, n: 0 };
        vote.n++;
        votes.set(key, vote);
      }
    }
  }
  // A pocket ceiling is a whole circle; an arc of the foot's outline that
  // happens to match the radius only covers part of one.
  const wholeRing = (cx: number, cy: number): boolean => {
    const sectors = new Set<number>();
    for (const [x, y] of points) {
      if (Math.abs(Math.hypot(x - cx, y - cy) - radius) > 0.05) continue;
      sectors.add(Math.floor(((Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI)) * 8) % 8);
    }
    return sectors.size === 8;
  };
  const accepted: Array<{ x: number; y: number }> = [];
  for (const v of [...votes.values()].sort((a, b) => b.n - a.n)) {
    if (v.n < 15) break;
    if (accepted.some((a) => Math.hypot(a.x - v.x, a.y - v.y) < 1)) continue;
    if (wholeRing(v.x, v.y)) accepted.push(v);
  }
  const round = (v: number): number => Math.round(v * 10) / 10 + 0;
  return accepted.map((a) => `${round(a.x)},${round(a.y)}`).sort();
}

/**
 * Solid between a hole and the flank beyond it, along `axis` in `direction`
 * from the hole's centre at `z` above the underside. Zero when the bore opens
 * through the flank, which leaves no material on that side of it.
 */
export function outboardWallMm(
  mesh: MeshData,
  [x, y]: readonly [number, number],
  z: number,
  axis: 'x' | 'y' = 'x',
  direction: 1 | -1 = 1
): number {
  const minZ = lowestZ(mesh);
  // Rotate the axes so a vertical column probe runs along the chosen one.
  const rotated = new Float32Array(mesh.vertices.length);
  for (let i = 0; i < rotated.length; i += 3) {
    const vx = mesh.vertices[i];
    const vy = mesh.vertices[i + 1];
    rotated[i] = axis === 'x' ? vy : vx;
    rotated[i + 1] = mesh.vertices[i + 2];
    rotated[i + 2] = axis === 'x' ? vx : vy;
  }
  const across = axis === 'x' ? y : x;
  const along = axis === 'x' ? x : y;
  // Off the hole's axis by a hair: the bore has a vertex exactly on it.
  const beyond = columnCrossings({ ...mesh, vertices: rotated }, across + 0.013, minZ + z)
    .filter((crossing) => (crossing - along) * direction > 0)
    .sort((a, b) => (a - b) * direction);
  return beyond.length >= 2 ? Math.abs(beyond[1] - beyond[0]) : 0;
}
