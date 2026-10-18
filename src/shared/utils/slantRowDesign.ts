import type { DesignId, FractionalEdge, SlantConfig } from '@/core/types';

/** The design a slanted row's bins share: the bins' size and height, leaning the row's way. */
export interface SlantRowDesignSpec {
  readonly name: string;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  /** Without an end support; the row's leading bin carries its own. */
  readonly slant: SlantConfig;
  readonly gridUnitMm: number;
  readonly gridUnitMmY?: number;
  readonly heightUnitMm: number;
  readonly fractionalEdgeX: FractionalEdge;
  readonly fractionalEdgeY: FractionalEdge;
}

/** Finds a saved design that matches, or saves a new one; null when none could be saved. */
export type SlantRowDesigner = (spec: SlantRowDesignSpec) => Promise<DesignId | null>;

let designer: SlantRowDesigner | null = null;

/** Registered from the shell, because designs are saved by the bin-designer feature. */
export function registerSlantRowDesigner(next: SlantRowDesigner | null): void {
  designer = next;
}

export function ensureSlantRowDesign(spec: SlantRowDesignSpec): Promise<DesignId | null> {
  return designer ? designer(spec) : Promise.resolve(null);
}
