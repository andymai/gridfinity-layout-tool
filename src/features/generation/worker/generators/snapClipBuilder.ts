import { box, cylinder, unwrap, fuseAll, mesh, exportSTL, translate } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { ExportFormat } from '../../bridge/types';
import {
  SNAP_PEG_DIAMETER,
  SNAP_PEG_INSET,
  SNAP_PEG_LENGTH,
  SNAP_SADDLE_WIDTH,
  SNAP_SADDLE_LENGTH_MARGIN,
  SNAP_SADDLE_BASE_HEIGHT,
  SNAP_SADDLE_ARCH_RISE,
} from './generatorConstants';

const PEG_RADIUS = SNAP_PEG_DIAMETER / 2;
const SADDLE_LEN = 2 * (SNAP_PEG_INSET + SNAP_SADDLE_LENGTH_MARGIN);

/**
 * Saddle clip in print orientation (base on Z=0, arch up):
 *
 *      ╭─────────────────╮      ← arch (half-cylinder cap)
 *      │                 │
 *      │     SADDLE      │      ← rectangular base
 *      │                 │
 *      ╶──┬─┬───────┬─┬──╴       ← pegs hang from the underside
 *         │ │       │ │
 *         ▼ ▼       ▼ ▼          (flipped before insertion: pegs go down)
 *
 * Two pegs straddle the seam; one sinks into each piece's blind hole. The
 * arch is just for grip and visual character — no mechanical role.
 */
export function buildSnapClip(): Shape3D {
  const baseZ = 0;
  const archZ = SNAP_SADDLE_BASE_HEIGHT;
  const archRadius = SNAP_SADDLE_ARCH_RISE;

  const base: Shape3D = box(SADDLE_LEN, SNAP_SADDLE_WIDTH, SNAP_SADDLE_BASE_HEIGHT, {
    at: [0, 0, baseZ + SNAP_SADDLE_BASE_HEIGHT / 2],
  });

  // Cylinder is built along its own +Z; lay it on its side (rotate 90° about
  // Y so it points along X) and place it centered on top of the base.
  const archCyl = cylinder(archRadius, SADDLE_LEN, {
    at: [-SADDLE_LEN / 2, 0, 0],
    axis: [1, 0, 0],
  }) as Shape3D;
  const arch = translate(archCyl, [0, 0, archZ]);

  const peg = (x: number): Shape3D =>
    cylinder(PEG_RADIUS, SNAP_PEG_LENGTH, {
      at: [x, 0, -SNAP_PEG_LENGTH],
    });

  return unwrap(fuseAll([base, arch, peg(-SNAP_PEG_INSET), peg(SNAP_PEG_INSET)] as ValidSolid[]));
}

export async function exportSnapClip(
  format: ExportFormat,
  tolerance = 0.01,
  angularTolerance = 5
): Promise<{ data: ArrayBuffer; fileName: string }> {
  const clip = buildSnapClip() as ValidSolid;
  try {
    if (format === 'step') {
      const { exportSTEP } = await import('brepjs');
      const blob = unwrap(exportSTEP(clip));
      return { data: await blob.arrayBuffer(), fileName: 'snap-clip.step' };
    }
    mesh(clip, { tolerance, angularTolerance, cache: false });
    const blob = unwrap(exportSTL(clip, { tolerance, angularTolerance, binary: true }));
    return { data: await blob.arrayBuffer(), fileName: 'snap-clip.stl' };
  } finally {
    clip.delete();
  }
}
