/**
 * Advisory printability checks over a Workshop build — pure math on the
 * placed-part list, no OCCT. Warnings inform (a tree badge, inspector
 * messages); they never block anything: the printer owner decides.
 */
import type { AssemblyStructure } from '@/shared/types/assembly';
import type { PlacedPart } from '@/shared/types/assemblyPlacement';
import type { ItemEnvelope } from '@/shared/types/item';
import { partFootprint, resolvePlacedParts, rotate2d } from '@/shared/types/assemblyPlacement';

export type AssemblyWarningKind =
  'floating' | 'unsupported' | 'overhang' | 'socketBreach' | 'outsideBase';

export interface AssemblyWarning {
  readonly partId: string;
  readonly kind: AssemblyWarningKind;
}

/** Lift above the seat plane beyond which a part counts as floating. */
const FLOAT_TOLERANCE_MM = 0.05;

/** Sloped tops past this print as unsupported overhang. */
const OVERHANG_LIMIT_DEG = 45;

/** Bridges (arch crossbars) beyond this span tend to sag. */
const BRIDGE_LIMIT_MM = 80;

/** Horizontal hook arms beyond this reach tend to droop. */
const HOOK_REACH_LIMIT_MM = 40;

export function checkAssembly(
  structure: AssemblyStructure,
  envelope: ItemEnvelope
): AssemblyWarning[] {
  const extent = {
    w: envelope.width * envelope.gridUnitMm,
    d: envelope.depth * envelope.gridUnitMm,
  };
  const placed = resolvePlacedParts(structure, extent);
  const byKey = new Map<string, PlacedPart>();
  for (const p of placed) byKey.set(p.key, p);
  const parentInstanceOf = (p: PlacedPart): PlacedPart | null => {
    const slash = p.key.lastIndexOf('/');
    if (slash === -1) return null;
    return byKey.get(p.key.slice(0, slash)) ?? null;
  };

  const warnings: AssemblyWarning[] = [];
  const flagged = new Set<string>();
  const flag = (partId: string, kind: AssemblyWarningKind): void => {
    const key = `${partId}:${kind}`;
    if (flagged.has(key)) return;
    flagged.add(key);
    warnings.push({ partId, kind });
  };

  for (const p of placed) {
    const { node } = p;

    // Floating: lifted above its seat plane with nothing under it.
    if (node.type !== 'cutter' && node.transform.seatZ > FLOAT_TOLERANCE_MM) {
      flag(p.selectId, 'floating');
    }

    // Unsupported: seated on a parent but anchored outside its top face.
    // Compared per expanded INSTANCE in the parent's frame, so array copies
    // marching off their parent are caught too.
    if (node.type !== 'cutter' && p.parentId !== null) {
      const parent = parentInstanceOf(p);
      if (parent) {
        const parentHalf = partFootprint(parent.node);
        const local = rotate2d(p.x - parent.x, p.y - parent.y, -parent.rotZDeg);
        if (Math.abs(local.x) > parentHalf.w / 2 || Math.abs(local.y) > parentHalf.d / 2) {
          flag(p.selectId, 'unsupported');
        }
      }
    }

    // Overhangs the printer cannot self-support.
    if (node.type === 'block' && node.params.wedgeAngleDeg > OVERHANG_LIMIT_DEG) {
      flag(p.selectId, 'overhang');
    }
    if (node.type === 'arch' && node.params.span > BRIDGE_LIMIT_MM) {
      flag(p.selectId, 'overhang');
    }
    if (node.type === 'hook' && node.params.reach > HOOK_REACH_LIMIT_MM) {
      flag(p.selectId, 'overhang');
    }

    // A cutter reaching below the floor plate carves into the socket.
    if (node.type === 'cutter' && p.z - node.params.depth < -structure.base.floorThickness) {
      flag(p.selectId, 'socketBreach');
    }

    // Off the base: material past the plate edge prints in mid-air. The
    // footprint is local-frame, so rotate it into a world-axis bound first.
    if (node.type !== 'cutter') {
      const half = partFootprint(node);
      const rad = (p.rotZDeg * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const halfW = (cos * half.w + sin * half.d) / 2;
      const halfD = (sin * half.w + cos * half.d) / 2;
      if (
        p.x - halfW < -0.05 ||
        p.x + halfW > extent.w + 0.05 ||
        p.y - halfD < -0.05 ||
        p.y + halfD > extent.d + 0.05
      ) {
        flag(p.selectId, 'outsideBase');
      }
    }
  }
  return warnings;
}
