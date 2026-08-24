/**
 * Per-part mapping from drag handles to the params they drive. A handle
 * slides along one part-local axis; `offset` places it from the part anchor
 * and `fromOffset` inverts a dragged offset back into the param value, so
 * parts whose footprint is derived (tube outer = bore + 2·wall, arch width
 * = span + 2·uprights) resize from the edge the user actually grabbed.
 * Ranges mirror the inspector fields; the descriptor schema stays the
 * authority — `updateAssemblyPartParams` re-validates every commit.
 */
import type { AssemblyPartNode, AssemblyPartParams } from '@/shared/types/assembly';

export interface ResizeHandleDef {
  /** Stable key for React and the typed-label editor. */
  readonly key: string;
  readonly axis: 'x' | 'y' | 'z';
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** Current param value (what the label shows). */
  readonly read: (node: AssemblyPartNode) => number;
  /** Handle offset along `axis` from the part anchor, in part-local mm. */
  readonly offset: (node: AssemblyPartNode) => number;
  /** Dragged offset → raw param value (before step/clamp). */
  readonly fromOffset: (offset: number, node: AssemblyPartNode) => number;
  /** Param patch committing `value`. */
  readonly apply: (value: number, node: AssemblyPartNode) => Partial<AssemblyPartParams>;
}

type Params<T extends AssemblyPartNode['type']> = Extract<AssemblyPartNode, { type: T }>['params'];

function span<T extends AssemblyPartNode['type']>(
  key: keyof Params<T> & string,
  axis: 'x' | 'y',
  min: number,
  max: number,
  step: number
): ResizeHandleDef {
  const value = (node: AssemblyPartNode): number => {
    const raw = (node.params as unknown as Record<string, unknown>)[key];
    return typeof raw === 'number' ? raw : 0;
  };
  return {
    key,
    axis,
    min,
    max,
    step,
    read: value,
    offset: (node) => value(node) / 2,
    fromOffset: (offset) => offset * 2,
    apply: (v) => ({ [key]: v }),
  };
}

function height<T extends AssemblyPartNode['type']>(
  key: keyof Params<T> & string,
  min: number,
  max: number,
  step: number
): ResizeHandleDef {
  const value = (node: AssemblyPartNode): number => {
    const raw = (node.params as unknown as Record<string, unknown>)[key];
    return typeof raw === 'number' ? raw : 0;
  };
  return {
    key,
    axis: 'z',
    min,
    max,
    step,
    read: value,
    offset: value,
    fromOffset: (offset) => offset,
    apply: (v) => ({ [key]: v }),
  };
}

/** Handles for the selected part, in a stable order (x, y, z). */
export function resizeHandlesFor(node: AssemblyPartNode): ResizeHandleDef[] {
  switch (node.type) {
    case 'post':
      return [span<'post'>('diameter', 'x', 2, 60, 0.5), height<'post'>('height', 4, 200, 1)];
    case 'fin':
      return [
        span<'fin'>('length', 'x', 4, 400, 1),
        span<'fin'>('thickness', 'y', 0.8, 20, 0.2),
        height<'fin'>('height', 4, 200, 1),
      ];
    case 'block':
      return [
        span<'block'>('width', 'x', 2, 400, 1),
        span<'block'>('depth', 'y', 2, 400, 1),
        height<'block'>('height', 1, 200, 1),
      ];
    case 'tube':
      return [
        {
          key: 'boreDiameter',
          axis: 'x',
          min: 2,
          max: 80,
          step: 0.5,
          read: (n) => (n.type === 'tube' ? n.params.boreDiameter : 0),
          offset: (n) => (n.type === 'tube' ? (n.params.boreDiameter + 2 * n.params.wall) / 2 : 0),
          fromOffset: (offset, n) =>
            n.type === 'tube' ? offset * 2 - 2 * n.params.wall : offset * 2,
          apply: (v) => ({ boreDiameter: v }),
        },
        height<'tube'>('height', 4, 200, 1),
      ];
    case 'cradle':
      return [
        span<'cradle'>('length', 'x', 4, 400, 1),
        span<'cradle'>('width', 'y', 4, 100, 1),
        height<'cradle'>('height', 4, 100, 1),
      ];
    case 'hook':
      return [
        span<'hook'>('width', 'x', 2, 100, 1),
        span<'hook'>('reach', 'y', 4, 100, 1),
        height<'hook'>('stemHeight', 4, 200, 1),
      ];
    case 'arch':
      return [
        {
          key: 'span',
          axis: 'x',
          min: 8,
          max: 400,
          step: 1,
          read: (n) => (n.type === 'arch' ? n.params.span : 0),
          offset: (n) =>
            n.type === 'arch' ? (n.params.span + 2 * n.params.uprightThickness) / 2 : 0,
          fromOffset: (offset, n) =>
            n.type === 'arch' ? offset * 2 - 2 * n.params.uprightThickness : offset * 2,
          apply: (v) => ({ span: v }),
        },
        span<'arch'>('depth', 'y', 4, 60, 1),
        height<'arch'>('height', 8, 200, 1),
      ];
    case 'comb':
      return [
        span<'comb'>('width', 'x', 10, 300, 1),
        span<'comb'>('depth', 'y', 4, 80, 1),
        height<'comb'>('height', 5, 120, 1),
      ];
    case 'riser':
      return [
        span<'riser'>('width', 'x', 10, 300, 1),
        {
          key: 'stepDepth',
          axis: 'y',
          min: 5,
          max: 80,
          step: 1,
          read: (n) => (n.type === 'riser' ? n.params.stepDepth : 0),
          offset: (n) => (n.type === 'riser' ? (n.params.stepCount * n.params.stepDepth) / 2 : 0),
          fromOffset: (offset, n) =>
            n.type === 'riser' ? (offset * 2) / n.params.stepCount : offset * 2,
          apply: (v) => ({ stepDepth: v }),
        },
        {
          key: 'stepHeight',
          axis: 'z',
          min: 2,
          max: 60,
          step: 1,
          read: (n) => (n.type === 'riser' ? n.params.stepHeight : 0),
          offset: (n) => (n.type === 'riser' ? n.params.stepCount * n.params.stepHeight : 0),
          fromOffset: (offset, n) => (n.type === 'riser' ? offset / n.params.stepCount : offset),
          apply: (v) => ({ stepHeight: v }),
        },
      ];
    case 'boreBank':
      return [
        span<'boreBank'>('width', 'x', 10, 300, 1),
        span<'boreBank'>('depth', 'y', 8, 120, 1),
        height<'boreBank'>('height', 8, 120, 1),
      ];
    case 'cutter': {
      const profile = node.params.profile;
      const patch = (next: Record<string, number>): Partial<AssemblyPartParams> => ({
        profile: { ...profile, ...next },
      });
      const profileNumber = (n: AssemblyPartNode, key: string): number => {
        if (n.type !== 'cutter') return 0;
        const value = (n.params.profile as unknown as Record<string, unknown>)[key];
        return typeof value === 'number' ? value : 0;
      };
      const profileSpan = (
        key: 'diameter' | 'width' | 'depth' | 'length',
        axis: 'x' | 'y',
        min: number,
        max: number,
        step: number
      ): ResizeHandleDef => ({
        key: `profile.${key}`,
        axis,
        min,
        max,
        step,
        read: (n) => profileNumber(n, key),
        offset: (n) => profileNumber(n, key) / 2,
        fromOffset: (offset) => offset * 2,
        apply: (v) => patch({ [key]: v }),
      });
      switch (profile.shape) {
        case 'circle':
        case 'polygon':
          return [profileSpan('diameter', 'x', 0.5, 200, 0.5)];
        case 'rectangle':
          return [
            profileSpan('width', 'x', 0.5, 400, 0.5),
            profileSpan('depth', 'y', 0.5, 400, 0.5),
          ];
        case 'slot':
          return [
            profileSpan('length', 'x', 1, 400, 0.5),
            profileSpan('width', 'y', 0.5, 200, 0.5),
          ];
        case 'path':
        case 'outline':
          return [];
      }
    }
  }
}
