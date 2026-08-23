/**
 * Advisory printability checks over a Workshop build — pure math on the
 * placed-part list, no OCCT. Warnings inform (a tree badge, inspector
 * messages); they never block anything: the printer owner decides.
 */
import type { AssemblyStructure } from '@/shared/types/assembly';
import type { PlacedPart } from '@/shared/types/assemblyPlacement';
import type { ItemEnvelope } from '@/shared/types/item';
import { partFootprint, resolvePlacedParts } from '@/shared/types/assemblyPlacement';

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
  const byId = new Map<string, PlacedPart>();
  for (const p of placed) {
    if (!byId.has(p.selectId)) byId.set(p.selectId, p);
  }

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
    if (node.type !== 'cutter' && p.parentId !== null) {
      const parent = byId.get(p.parentId);
      if (parent) {
        const half = partFootprint(parent.node);
        if (Math.abs(node.transform.x) > half.w / 2 || Math.abs(node.transform.y) > half.d / 2) {
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

    // Off the base: material past the plate edge prints in mid-air.
    if (node.type !== 'cutter') {
      const half = partFootprint(node);
      if (
        p.x - half.w / 2 < -0.05 ||
        p.x + half.w / 2 > extent.w + 0.05 ||
        p.y - half.d / 2 < -0.05 ||
        p.y + half.d / 2 > extent.d + 0.05
      ) {
        flag(p.selectId, 'outsideBase');
      }
    }
  }
  return warnings;
}
