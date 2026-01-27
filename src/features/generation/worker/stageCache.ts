/**
 * Worker-side stage cache for BREP generation.
 *
 * Caches intermediate Shape3D objects between generation calls so that
 * when only later-stage parameters change (e.g., compartments, inserts),
 * earlier stages (base, shell) can be reused without recomputation.
 *
 * Stage dependency chain:
 *   base → shell → assembly → features
 *
 * If "shell" params change, base is reused but shell/assembly/features rebuild.
 * If only "features" params change, base/shell/assembly are all reused.
 *
 * Lives in worker scope — Shape3D objects are WASM heap references
 * and cannot be transferred across threads.
 */

import type { BinParams } from '@/shared/types/bin';

/** Invalidation levels ordered from earliest to latest stage */
export type InvalidationLevel = 'base' | 'shell' | 'assembly' | 'features' | 'none';

/** Parameters that affect the base socket stage */
interface BaseKey {
  width: number;
  depth: number;
  gridUnitMm: number;
  baseStyle: string;
  magnetDiameter: number;
  magnetDepth: number;
  screwDiameter: number;
}

/** Parameters that affect the shell/box stage */
interface ShellKey {
  width: number;
  depth: number;
  height: number;
  wallThickness: number;
  style: string;
  heightUnitMm: number;
}

/** Parameters that affect the assembly stage (base+shell fusion) */
interface AssemblyKey {
  stackingLip: boolean;
}

/** Parameters that affect the features stage */
interface FeaturesKey {
  compartments: string; // JSON-serialized
  inserts: string; // JSON-serialized
}

function extractBaseKey(params: BinParams): BaseKey {
  return {
    width: params.width,
    depth: params.depth,
    gridUnitMm: params.gridUnitMm,
    baseStyle: params.base.style,
    magnetDiameter: params.base.magnetDiameter,
    magnetDepth: params.base.magnetDepth,
    screwDiameter: params.base.screwDiameter,
  };
}

function extractShellKey(params: BinParams): ShellKey {
  return {
    width: params.width,
    depth: params.depth,
    height: params.height,
    wallThickness: params.wallThickness,
    style: params.style,
    heightUnitMm: params.heightUnitMm,
  };
}

function extractAssemblyKey(params: BinParams): AssemblyKey {
  return {
    stackingLip: params.base.stackingLip,
  };
}

function extractFeaturesKey(params: BinParams): FeaturesKey {
  return {
    compartments: JSON.stringify(params.compartments),
    inserts: JSON.stringify(params.inserts),
  };
}

function keysEqual<T extends object>(a: T, b: T): boolean {
  const aKeys = Object.keys(a) as Array<keyof T>;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Determine the earliest invalidated stage by comparing previous and current params.
 * Returns 'none' if all stages can be reused.
 */
export function getInvalidationLevel(prev: BinParams | null, next: BinParams): InvalidationLevel {
  if (!prev) return 'base'; // No cache — rebuild everything

  // Check from earliest to latest stage
  if (!keysEqual(extractBaseKey(prev), extractBaseKey(next))) {
    return 'base';
  }
  if (!keysEqual(extractShellKey(prev), extractShellKey(next))) {
    return 'shell';
  }
  if (!keysEqual(extractAssemblyKey(prev), extractAssemblyKey(next))) {
    return 'assembly';
  }
  if (!keysEqual(extractFeaturesKey(prev), extractFeaturesKey(next))) {
    return 'features';
  }

  return 'none';
}

/**
 * Cache for intermediate BREP generation stages.
 *
 * Stores Shape3D references from previous generation runs.
 * Shape3D objects live on the WASM heap and can only be accessed
 * within the worker thread.
 */
export class StageCache {
  private prevParams: BinParams | null = null;
  private baseShape: unknown | null = null; // Shape3D
  private shellShape: unknown | null = null; // Shape3D
  private assemblyShape: unknown | null = null; // Shape3D

  /**
   * Get the invalidation level for new params vs cached params.
   */
  getInvalidationLevel(params: BinParams): InvalidationLevel {
    return getInvalidationLevel(this.prevParams, params);
  }

  /** Get cached base socket shape (or null if invalidated) */
  getBase(): unknown | null {
    return this.baseShape;
  }

  /** Get cached shell/box shape (or null if invalidated) */
  getShell(): unknown | null {
    return this.shellShape;
  }

  /** Get cached assembly shape (or null if invalidated) */
  getAssembly(): unknown | null {
    return this.assemblyShape;
  }

  /** Store the base socket shape after computation */
  setBase(shape: unknown): void {
    this.baseShape = shape;
  }

  /** Store the shell/box shape after computation */
  setShell(shape: unknown): void {
    this.shellShape = shape;
  }

  /** Store the assembled shape (base+shell+lip) after computation */
  setAssembly(shape: unknown): void {
    this.assemblyShape = shape;
  }

  /** Update cached params after a successful generation */
  setParams(params: BinParams): void {
    this.prevParams = params;
  }

  /**
   * Invalidate stages at or after the given level.
   * Called before regeneration to clear stale cache entries.
   */
  invalidateFrom(level: InvalidationLevel): void {
    switch (level) {
      case 'base':
        this.baseShape = null;
        this.shellShape = null;
        this.assemblyShape = null;
        break;
      case 'shell':
        this.shellShape = null;
        this.assemblyShape = null;
        break;
      case 'assembly':
        this.assemblyShape = null;
        break;
      case 'features':
      case 'none':
        // Features don't cache intermediate — only assembly matters
        break;
    }
  }

  /** Clear all cached data */
  clear(): void {
    this.prevParams = null;
    this.baseShape = null;
    this.shellShape = null;
    this.assemblyShape = null;
  }
}
