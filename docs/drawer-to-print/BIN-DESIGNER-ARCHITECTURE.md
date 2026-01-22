# Bin Designer - System Architecture

## Overview

**Feature:** Bin Designer with replicad CAD Engine
**Version:** 1.0
**Status:** Planning
**Last Updated:** 2025-01-21

### Related Documents

| Document | Purpose | Link |
|----------|---------|------|
| **Product Requirements** | User stories, acceptance criteria | [BIN-DESIGNER-PRD.md](./BIN-DESIGNER-PRD.md) |
| **System Architecture** | This document - technical implementation | — |
| **Design Requirements** | UI/UX specifications, accessibility | [BIN-DESIGNER-DRD.md](./BIN-DESIGNER-DRD.md) |
| **Original Architecture** | Layout export features (separate scope) | [ARCHITECTURE.md](./ARCHITECTURE.md) |

---

## Executive Summary

The Bin Designer uses **replicad** (OpenCascade WASM) as its CAD engine to generate parametric Gridfinity bins with CAD-grade precision. The architecture emphasizes:

1. **Client-Side Generation** - All CAD operations run in Web Workers, no server required
2. **Lazy Loading** - 3MB WASM bundle loads only when Designer route is accessed
3. **Cancellable Queue** - New parameters cancel in-progress generation
4. **Shared Storage** - IndexedDB database shared with Layout Planner for seamless sync
5. **PWA Offline** - Full functionality after initial WASM cache

---

## Technology Choice: replicad

### Why replicad?

replicad is a TypeScript CAD library built on OpenCascade (OCCT) compiled to WebAssembly. It provides:

| Capability | Benefit for Bin Designer |
|------------|--------------------------|
| **BREP Geometry** | Mathematically precise surfaces (not mesh approximations) |
| **Native Fillets** | Perfect Gridfinity edge radii without mesh artifacts |
| **STEP Export** | CAD interoperability for power users |
| **Text Shapes** | Built-in text for label embossing |
| **Boolean Operations** | Clean CSG for inserts and cavities |
| **Chainable API** | Readable, maintainable generation code |

### Comparison: replicad vs JSCAD

| Aspect | replicad | JSCAD |
|--------|----------|-------|
| Kernel | OpenCascade (BREP) | Custom mesh CSG |
| Fillets | Native, exact | Approximated, can fail on complex shapes |
| STEP Export | Yes | No |
| Text | Yes (built-in) | Requires external font loading |
| Bundle | ~3MB WASM | ~1MB JS |
| API Style | CadQuery/Python-like | OpenSCAD-like |

**Decision:** replicad's precision is essential for Gridfinity compliance and STEP export.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Main Thread)                        │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  Designer   │  │   Zustand   │  │   Preview   │  │   Export   │ │
│  │     UI      │  │    Store    │  │   Canvas    │  │   Dialog   │ │
│  │  (React)    │  │ (designer)  │  │  (Three.js) │  │            │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │
│         │                │                │                │        │
│         └────────────────┴────────┬───────┴────────────────┘        │
│                                   │                                  │
│  ┌────────────────────────────────▼─────────────────────────────┐   │
│  │                    GenerationBridge                           │   │
│  │  - Manages Web Worker communication                           │   │
│  │  - Implements cancellation via AbortController                │   │
│  │  - Debounces parameter changes (200ms)                        │   │
│  │  - Transfers mesh data via SharedArrayBuffer                  │   │
│  └────────────────────────────────┬─────────────────────────────┘   │
│                                   │                                  │
└───────────────────────────────────┼──────────────────────────────────┘
                                    │ postMessage
┌───────────────────────────────────▼──────────────────────────────────┐
│                         Web Worker Thread                            │
├──────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                      ReplicadEngine                             │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │  │
│  │  │   replicad   │  │   Bin        │  │   Insert             │  │  │
│  │  │   WASM       │  │   Generators │  │   Templates          │  │  │
│  │  │   (OCCT)     │  │              │  │                      │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Output: { mesh: ArrayBuffer, step?: string, metadata: {...} }       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
src/
├── features/
│   └── bin-designer/                    # Bin Designer feature module
│       ├── index.ts                     # Public exports
│       ├── components/
│       │   ├── DesignerPage.tsx         # Main page component (route: /designer)
│       │   ├── ParameterPanel.tsx       # Left sidebar with all parameters
│       │   ├── PreviewCanvas.tsx        # Three.js 3D preview
│       │   ├── InsertEditor.tsx         # Visual insert placement
│       │   ├── TemplateLibrary.tsx      # Insert template browser
│       │   ├── ExportDialog.tsx         # Export format selection
│       │   ├── BatchCart.tsx            # Queue for batch export
│       │   ├── ShareDialog.tsx          # Share code generation/input
│       │   └── LoadingScreen.tsx        # WASM loading progress
│       ├── hooks/
│       │   ├── useDesignerStore.ts      # Zustand store selector hooks
│       │   ├── useGeneration.ts         # Generation bridge hook
│       │   ├── usePreview.ts            # Three.js preview management
│       │   ├── useInsertEditor.ts       # Insert drag-drop state
│       │   ├── useExport.ts             # Export flow orchestration
│       │   └── useDesignerSharing.ts    # Share code operations
│       ├── store/
│       │   └── designer.ts              # Zustand store definition
│       ├── types/
│       │   ├── index.ts                 # All Designer types
│       │   ├── binParams.ts             # BinParams interface
│       │   ├── insertTemplate.ts        # InsertTemplate interface
│       │   └── generationResult.ts      # Worker output types
│       └── utils/
│           ├── validation.ts            # Parameter validation
│           ├── defaults.ts              # Default parameter values
│           └── fileNaming.ts            # Export filename generation
│
├── features/
│   └── generation/                      # CAD Generation Engine (separate feature)
│       ├── index.ts                     # Public exports
│       ├── worker/
│       │   ├── generation.worker.ts     # Web Worker entry point
│       │   ├── ReplicadEngine.ts        # replicad wrapper class
│       │   ├── generators/
│       │   │   ├── binGenerator.ts      # Main bin generation
│       │   │   ├── baseGenerator.ts     # Base/magnet/screw features
│       │   │   ├── dividerGenerator.ts  # Internal dividers
│       │   │   ├── scoopGenerator.ts    # Finger scoop cutouts
│       │   │   ├── labelGenerator.ts    # Label area + text embossing
│       │   │   └── insertGenerator.ts   # Custom insert cavities
│       │   └── templates/
│       │       ├── electronics.ts       # Battery, SD card, USB templates
│       │       ├── hardware.ts          # Screws, nuts, hex key templates
│       │       └── tools.ts             # Screwdriver, pen holder templates
│       ├── bridge/
│       │   ├── GenerationBridge.ts      # Main thread ↔ Worker communication
│       │   └── types.ts                 # Message types for postMessage
│       ├── export/
│       │   ├── stlExporter.ts           # STL binary generation
│       │   ├── stepExporter.ts          # STEP file generation
│       │   ├── threeMfExporter.ts       # 3MF project generation
│       │   └── zipExporter.ts           # Batch ZIP packaging
│       └── utils/
│           ├── meshUtils.ts             # Mesh optimization utilities
│           └── printEstimates.ts        # Filament/time estimation
│
├── core/
│   └── storage/
│       ├── DesignerStorage.ts           # Designer-specific IndexedDB operations
│       └── ...existing storage files
│
└── shared/
    └── analytics/
        └── useMLTracking.ts             # Extended for Designer events
```

---

## Core Data Types

### BinParams

```typescript
// src/features/bin-designer/types/binParams.ts

export interface BinParams {
  // Dimensions (Gridfinity units)
  width: number;          // 0.5-6, 0.5 increments
  depth: number;          // 0.5-6, 0.5 increments
  height: number;         // 1-12, integer units (7mm each)

  // Base configuration
  base: {
    style: 'standard' | 'magnet' | 'screw' | 'weighted';
    magnetDiameter: number;    // 6mm default
    magnetDepth: number;       // 2-4mm
    screwDiameter: number;     // 3mm (M3) default
    stackingLip: boolean;      // Enable stacking on other bins
  };

  // Bin style variant
  style: 'standard' | 'lite' | 'solid' | 'vase' | 'rugged';

  // Dividers
  dividers: {
    x: number;                 // 0-10 dividers in X direction
    y: number;                 // 0-10 dividers in Y direction
    thickness: number;         // 0.8-2.0mm, default 1.2mm
  };

  // Features
  scoop: boolean;              // Add finger scoops to compartments

  label: {
    enabled: boolean;
    text: string;              // Max 20 characters
    fontSize: 'auto' | number; // Auto-fit or explicit size
  };

  // Side cutouts (wall height per side, 0-100%)
  walls: {
    front: number;
    back: number;
    left: number;
    right: number;
  };

  // Custom inserts
  inserts: Insert[];
}

export interface Insert {
  id: string;
  type: 'rectangle' | 'circle' | 'hexagon' | 'rounded-rect' | 'template';
  templateId?: string;         // If type === 'template'
  position: { x: number; y: number };  // mm from bin interior origin
  size: { width: number; height: number } | { diameter: number };
  depth: number;               // Cavity depth in mm
  rotation: number;            // Degrees
}
```

### InsertTemplate

```typescript
// src/features/bin-designer/types/insertTemplate.ts

export interface InsertTemplate {
  id: string;
  name: string;
  category: 'electronics' | 'hardware' | 'tools' | 'custom';
  description: string;
  thumbnail: string;           // Data URL or path

  // Geometry definition
  shape: InsertShape;

  // Configurable parameters (shown to user)
  configurableParams: ConfigurableParam[];

  // Default values
  defaults: Record<string, number | boolean | string>;
}

export type InsertShape =
  | { type: 'cylinder'; diameter: number; height: number }
  | { type: 'box'; width: number; depth: number; height: number; fillet?: number }
  | { type: 'hex'; across_flats: number; height: number }
  | { type: 'slot'; width: number; length: number; height: number }
  | { type: 'custom'; generator: string };  // Reference to generator function

export interface ConfigurableParam {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'select';
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}
```

### DesignerState (Zustand Store)

```typescript
// src/features/bin-designer/store/designer.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface DesignerState {
  // Current design
  params: BinParams;

  // Generation state
  generation: {
    status: 'idle' | 'generating' | 'complete' | 'error';
    progress: number;          // 0-100
    mesh: ArrayBuffer | null;  // Current preview mesh
    error: string | null;
  };

  // History (undo/redo)
  history: {
    past: BinParams[];
    future: BinParams[];
  };

  // Batch cart
  cart: SavedDesign[];

  // WASM loading state
  wasmStatus: 'loading' | 'ready' | 'error';
  wasmProgress: number;

  // UI state
  ui: {
    activeTab: 'dimensions' | 'features' | 'inserts' | 'export';
    insertEditorOpen: boolean;
    templateBrowserOpen: boolean;
  };

  // Actions
  setParam: <K extends keyof BinParams>(key: K, value: BinParams[K]) => void;
  setNestedParam: (path: string, value: unknown) => void;
  undo: () => void;
  redo: () => void;
  resetToDefaults: () => void;
  addToCart: (design: SavedDesign) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  loadDesign: (params: BinParams) => void;
}

export interface SavedDesign {
  id: string;
  name: string;
  params: BinParams;
  thumbnail: string;           // Data URL
  createdAt: number;
  estimatedFilament: number;   // grams
  estimatedTime: number;       // minutes
}
```

---

## Generation Pipeline

### Web Worker Architecture

```typescript
// src/features/generation/worker/generation.worker.ts

import { Replicad } from 'replicad';
import { ReplicadEngine } from './ReplicadEngine';

let engine: ReplicadEngine | null = null;
let currentGeneration: AbortController | null = null;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload, requestId } = event.data;

  switch (type) {
    case 'INIT':
      // Load WASM and initialize engine
      try {
        const replicad = await Replicad.init();
        engine = new ReplicadEngine(replicad);
        self.postMessage({ type: 'INIT_COMPLETE', requestId });
      } catch (error) {
        self.postMessage({ type: 'INIT_ERROR', error: String(error), requestId });
      }
      break;

    case 'GENERATE':
      // Cancel any in-progress generation
      if (currentGeneration) {
        currentGeneration.abort();
      }
      currentGeneration = new AbortController();

      try {
        const result = await engine!.generateBin(
          payload.params,
          currentGeneration.signal,
          (progress) => {
            self.postMessage({ type: 'PROGRESS', progress, requestId });
          }
        );

        // Transfer mesh buffer (zero-copy)
        self.postMessage(
          { type: 'GENERATE_COMPLETE', result, requestId },
          [result.mesh]  // Transferable
        );
      } catch (error) {
        if (error.name !== 'AbortError') {
          self.postMessage({ type: 'GENERATE_ERROR', error: String(error), requestId });
        }
      }
      break;

    case 'EXPORT_STL':
      // ... STL export logic
      break;

    case 'EXPORT_STEP':
      // ... STEP export logic
      break;

    case 'EXPORT_3MF':
      // ... 3MF export logic
      break;
  }
};
```

### ReplicadEngine Class

```typescript
// src/features/generation/worker/ReplicadEngine.ts

import { draw, makeSolid, makeBox, makeCylinder } from 'replicad';
import type { BinParams, Insert } from '../../bin-designer/types';

export class ReplicadEngine {
  private replicad: typeof import('replicad');

  constructor(replicad: typeof import('replicad')) {
    this.replicad = replicad;
  }

  async generateBin(
    params: BinParams,
    signal: AbortSignal,
    onProgress: (progress: number) => void
  ): Promise<GenerationResult> {
    // Check for abort before each major step
    const checkAbort = () => {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    };

    onProgress(0);

    // 1. Generate base shape
    checkAbort();
    const base = this.generateBase(params);
    onProgress(20);

    // 2. Add dividers
    checkAbort();
    const withDividers = this.addDividers(base, params);
    onProgress(40);

    // 3. Add features (scoop, label)
    checkAbort();
    const withFeatures = this.addFeatures(withDividers, params);
    onProgress(60);

    // 4. Cut inserts
    checkAbort();
    const withInserts = this.cutInserts(withFeatures, params);
    onProgress(80);

    // 5. Generate mesh
    checkAbort();
    const mesh = withInserts.mesh({ tolerance: 0.1 });
    onProgress(100);

    return {
      mesh: mesh.toArrayBuffer(),
      boundingBox: withInserts.boundingBox(),
      volume: withInserts.volume(),
      metadata: {
        params,
        generatedAt: Date.now(),
      }
    };
  }

  private generateBase(params: BinParams) {
    const { width, depth, height } = params;

    // Gridfinity dimensions
    const GRID_SIZE = 42;        // mm per unit
    const HEIGHT_UNIT = 7;       // mm per height unit
    const WALL_THICKNESS = 1.2;  // mm
    const BOTTOM_THICKNESS = 2;  // mm
    const FILLET_RADIUS = 3.75;  // Gridfinity spec

    const outerWidth = width * GRID_SIZE - 0.5;  // Clearance
    const outerDepth = depth * GRID_SIZE - 0.5;
    const outerHeight = height * HEIGHT_UNIT;

    // Create outer shell with fillets
    let shell = makeBox(outerWidth, outerDepth, outerHeight)
      .fillet(FILLET_RADIUS, (e) => e.inDirection('Z'));

    // Hollow out interior
    const innerWidth = outerWidth - 2 * WALL_THICKNESS;
    const innerDepth = outerDepth - 2 * WALL_THICKNESS;
    const innerHeight = outerHeight - BOTTOM_THICKNESS;

    const cavity = makeBox(innerWidth, innerDepth, innerHeight)
      .translate([WALL_THICKNESS, WALL_THICKNESS, BOTTOM_THICKNESS]);

    shell = shell.cut(cavity);

    // Add base features (magnets, screws, etc.)
    shell = this.addBaseFeatures(shell, params);

    return shell;
  }

  private addDividers(solid: Solid, params: BinParams) {
    const { dividers, width, depth } = params;
    if (dividers.x === 0 && dividers.y === 0) return solid;

    const GRID_SIZE = 42;
    const innerWidth = width * GRID_SIZE - 0.5 - 2 * 1.2;
    const innerDepth = depth * GRID_SIZE - 0.5 - 2 * 1.2;

    let result = solid;

    // X dividers (running in Y direction)
    for (let i = 1; i <= dividers.x; i++) {
      const xPos = (i / (dividers.x + 1)) * innerWidth + 1.2;
      const divider = makeBox(dividers.thickness, innerDepth, params.height * 7 - 2)
        .translate([xPos - dividers.thickness / 2, 1.2, 2]);
      result = result.fuse(divider);
    }

    // Y dividers (running in X direction)
    for (let i = 1; i <= dividers.y; i++) {
      const yPos = (i / (dividers.y + 1)) * innerDepth + 1.2;
      const divider = makeBox(innerWidth, dividers.thickness, params.height * 7 - 2)
        .translate([1.2, yPos - dividers.thickness / 2, 2]);
      result = result.fuse(divider);
    }

    return result;
  }

  private addFeatures(solid: Solid, params: BinParams) {
    let result = solid;

    // Add scoop
    if (params.scoop) {
      result = this.addScoop(result, params);
    }

    // Add label
    if (params.label.enabled) {
      result = this.addLabel(result, params);
    }

    // Apply wall cutouts
    result = this.applyWallCutouts(result, params);

    return result;
  }

  private addLabel(solid: Solid, params: BinParams) {
    // Label area on front lip
    const { width } = params;
    const GRID_SIZE = 42;
    const labelWidth = width * GRID_SIZE - 10;  // 5mm margin each side
    const labelHeight = 12;  // mm
    const labelDepth = 0.4;  // Emboss depth

    // Create label recess
    const labelArea = makeBox(labelWidth, labelDepth, labelHeight)
      .translate([5, 0, params.height * 7 - labelHeight - 2]);

    let result = solid.cut(labelArea);

    // Add text if provided
    if (params.label.text) {
      const textShape = this.replicad.drawText(params.label.text, {
        fontSize: params.label.fontSize === 'auto' ? this.calculateFontSize(params.label.text, labelWidth) : params.label.fontSize,
        font: 'sans-serif',
      });

      const textSolid = textShape.extrude(labelDepth / 2)
        .translate([5 + labelWidth / 2, labelDepth / 2, params.height * 7 - labelHeight / 2 - 2]);

      result = result.fuse(textSolid);
    }

    return result;
  }

  private cutInserts(solid: Solid, params: BinParams) {
    let result = solid;

    for (const insert of params.inserts) {
      const cavity = this.generateInsertCavity(insert);
      result = result.cut(cavity);
    }

    return result;
  }

  private generateInsertCavity(insert: Insert) {
    // Generate cavity based on insert type
    switch (insert.type) {
      case 'rectangle':
        return makeBox(insert.size.width, insert.size.height, insert.depth)
          .translate([insert.position.x, insert.position.y, 2]);

      case 'circle':
        return makeCylinder(insert.size.diameter / 2, insert.depth)
          .translate([insert.position.x, insert.position.y, 2]);

      case 'hexagon':
        return this.makeHexagon(insert.size.diameter, insert.depth)
          .translate([insert.position.x, insert.position.y, 2]);

      case 'template':
        return this.generateFromTemplate(insert);

      default:
        throw new Error(`Unknown insert type: ${insert.type}`);
    }
  }

  // ... additional helper methods
}
```

### Generation Bridge (Main Thread)

```typescript
// src/features/generation/bridge/GenerationBridge.ts

export class GenerationBridge {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private requestIdCounter = 0;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      // Lazy load the worker
      this.worker = new Worker(
        new URL('../worker/generation.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = (e) => reject(new Error(e.message));

      const requestId = this.nextRequestId();
      this.pendingRequests.set(requestId, { resolve, reject });
      this.worker.postMessage({ type: 'INIT', requestId });
    });

    return this.initPromise;
  }

  async generate(
    params: BinParams,
    onProgress?: (progress: number) => void
  ): Promise<GenerationResult> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const requestId = this.nextRequestId();

      // Store progress callback separately
      if (onProgress) {
        this.progressCallbacks.set(requestId, onProgress);
      }

      this.pendingRequests.set(requestId, { resolve, reject });
      this.worker!.postMessage({
        type: 'GENERATE',
        payload: { params },
        requestId,
      });
    });
  }

  async exportSTL(mesh: ArrayBuffer, quality: 'draft' | 'standard' | 'high'): Promise<Blob> {
    // ... export implementation
  }

  async exportSTEP(): Promise<Blob> {
    // ... STEP export implementation
  }

  async export3MF(designs: SavedDesign[]): Promise<Blob> {
    // ... 3MF export implementation
  }

  private handleMessage(event: MessageEvent) {
    const { type, requestId, ...data } = event.data;

    switch (type) {
      case 'PROGRESS':
        this.progressCallbacks.get(requestId)?.(data.progress);
        break;

      case 'INIT_COMPLETE':
      case 'GENERATE_COMPLETE':
      case 'EXPORT_COMPLETE':
        this.pendingRequests.get(requestId)?.resolve(data.result);
        this.pendingRequests.delete(requestId);
        this.progressCallbacks.delete(requestId);
        break;

      case 'INIT_ERROR':
      case 'GENERATE_ERROR':
      case 'EXPORT_ERROR':
        this.pendingRequests.get(requestId)?.reject(new Error(data.error));
        this.pendingRequests.delete(requestId);
        this.progressCallbacks.delete(requestId);
        break;
    }
  }

  private nextRequestId(): string {
    return `req_${++this.requestIdCounter}`;
  }
}

// Singleton instance
export const generationBridge = new GenerationBridge();
```

---

## Storage Architecture

### Separate IndexedDB Database

The Designer uses a separate IndexedDB database to avoid conflicts with Layout Planner while enabling cross-feature data sharing.

```typescript
// src/core/storage/DesignerStorage.ts

import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface DesignerDB extends DBSchema {
  designs: {
    key: string;
    value: SavedDesign;
    indexes: {
      'by-created': number;
      'by-name': string;
    };
  };
  templates: {
    key: string;
    value: InsertTemplate;
    indexes: {
      'by-category': string;
    };
  };
  settings: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'gridfinity-designer-v1';
const DB_VERSION = 1;

class DesignerStorage {
  private db: IDBPDatabase<DesignerDB> | null = null;

  async initialize(): Promise<void> {
    this.db = await openDB<DesignerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Designs store
        const designStore = db.createObjectStore('designs', { keyPath: 'id' });
        designStore.createIndex('by-created', 'createdAt');
        designStore.createIndex('by-name', 'name');

        // Templates store (for custom user templates)
        const templateStore = db.createObjectStore('templates', { keyPath: 'id' });
        templateStore.createIndex('by-category', 'category');

        // Settings store
        db.createObjectStore('settings');
      },
    });
  }

  async saveDesign(design: SavedDesign): Promise<void> {
    await this.db!.put('designs', design);

    // Sync to Layout Planner library (if integration enabled)
    await this.syncToLayoutPlanner(design);
  }

  async loadDesign(id: string): Promise<SavedDesign | undefined> {
    return this.db!.get('designs', id);
  }

  async listDesigns(): Promise<SavedDesign[]> {
    return this.db!.getAllFromIndex('designs', 'by-created');
  }

  async deleteDesign(id: string): Promise<void> {
    await this.db!.delete('designs', id);
  }

  private async syncToLayoutPlanner(design: SavedDesign): Promise<void> {
    // Create a lightweight reference in the Layout Planner's custom bin library
    // This allows bins to appear in the Layout Planner without duplicating data
    const customBinRef = {
      id: `designer:${design.id}`,
      name: design.name,
      source: 'designer',
      width: design.params.width,
      depth: design.params.depth,
      height: design.params.height,
      thumbnail: design.thumbnail,
      designerId: design.id,  // Reference back to Designer storage
    };

    // Store in Layout Planner's custom bins index
    localStorage.setItem(
      `gridfinity-custom-bin-${customBinRef.id}`,
      JSON.stringify(customBinRef)
    );
  }
}

export const designerStorage = new DesignerStorage();
```

---

## API Integration

### Share Code Endpoints

The Designer reuses the existing Vercel backend for share codes, with a new `type` discriminator.

```typescript
// api/share.ts (additions)

interface DesignerSharePayload {
  type: 'designer';
  version: number;
  params: BinParams;
}

// Validation additions
function validateDesignerPayload(payload: DesignerSharePayload): boolean {
  // Validate BinParams schema
  const { params } = payload;

  if (params.width < 0.5 || params.width > 6) return false;
  if (params.depth < 0.5 || params.depth > 6) return false;
  if (params.height < 1 || params.height > 12) return false;
  // ... additional validation

  return true;
}
```

### Client-Side Share API

```typescript
// src/features/bin-designer/hooks/useDesignerSharing.ts

import { createShare, fetchShare } from '@/core/api/share';

export function useDesignerSharing() {
  const { params } = useDesignerStore();

  const createShareCode = async (): Promise<string> => {
    const payload: DesignerSharePayload = {
      type: 'designer',
      version: 1,
      params,
    };

    const result = await createShare(payload);
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    return result.data.shareId;
  };

  const loadFromShareCode = async (code: string): Promise<BinParams> => {
    const result = await fetchShare(code);
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    if (result.data.type !== 'designer') {
      throw new Error('Invalid share type');
    }

    return result.data.params;
  };

  return { createShareCode, loadFromShareCode };
}
```

---

## ML Telemetry Integration

Extend existing ML telemetry to capture Designer usage patterns.

```typescript
// src/shared/analytics/useMLTracking.ts (additions)

export interface DesignerTelemetryEvent {
  type: 'design_created' | 'design_exported' | 'template_used' | 'insert_placed';
  timestamp: number;

  // Design context
  dimensions: { width: number; depth: number; height: number };
  style: string;
  features: {
    hasDividers: boolean;
    hasScoop: boolean;
    hasLabel: boolean;
    hasInserts: boolean;
  };

  // Export context (if applicable)
  exportFormat?: 'stl' | 'step' | '3mf';

  // Template context (if applicable)
  templateId?: string;
  templateCategory?: string;
}

// Track Designer events alongside layout events
mlTracking.trackDesignerEvent = (event: DesignerTelemetryEvent) => {
  // Same batching/sending logic as layout events
  mlTracking.queueEvent({
    ...event,
    source: 'designer',
  });
};
```

---

## Performance Considerations

### WASM Loading Strategy

```typescript
// src/features/bin-designer/hooks/useWasmLoader.ts

export function useWasmLoader() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Only load WASM when Designer route is accessed
    const loadWasm = async () => {
      setStatus('loading');

      try {
        // Check if already cached
        const cache = await caches.open('replicad-wasm-v1');
        const cached = await cache.match('/replicad.wasm');

        if (cached) {
          setProgress(50);
        }

        await generationBridge.initialize();
        setStatus('ready');
        setProgress(100);
      } catch (error) {
        setStatus('error');
        console.error('WASM load failed:', error);
      }
    };

    loadWasm();
  }, []);

  return { status, progress };
}
```

### Generation Queue with Cancellation

```typescript
// src/features/bin-designer/hooks/useGeneration.ts

export function useGeneration() {
  const { params } = useDesignerStore();
  const [mesh, setMesh] = useState<ArrayBuffer | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Debounced generation trigger
  const debouncedParams = useDebouncedValue(params, 200);

  // Track current generation for cancellation
  const generationRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel previous generation
    generationRef.current?.abort();
    generationRef.current = new AbortController();

    const generate = async () => {
      setIsGenerating(true);

      try {
        const result = await generationBridge.generate(
          debouncedParams,
          (progress) => {
            // Update progress UI
          }
        );

        setMesh(result.mesh);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Generation failed:', error);
        }
      } finally {
        setIsGenerating(false);
      }
    };

    generate();

    return () => {
      generationRef.current?.abort();
    };
  }, [debouncedParams]);

  return { mesh, isGenerating };
}
```

---

## Insert Template Definitions

### Electronics Templates

```typescript
// src/features/generation/worker/templates/electronics.ts

export const electronicsTemplates: InsertTemplate[] = [
  {
    id: 'battery-aa',
    name: 'AA Battery',
    category: 'electronics',
    description: 'Standard AA battery holder (vertical)',
    thumbnail: '/templates/battery-aa.png',
    shape: {
      type: 'cylinder',
      diameter: 15,  // 14.5mm + 0.5mm clearance
      height: 51,    // 50.5mm + 0.5mm clearance
    },
    configurableParams: [
      {
        key: 'orientation',
        label: 'Orientation',
        type: 'select',
        options: [
          { value: 'vertical', label: 'Vertical' },
          { value: 'horizontal', label: 'Horizontal' },
        ],
      },
      {
        key: 'count',
        label: 'Count',
        type: 'number',
        min: 1,
        max: 10,
        step: 1,
      },
    ],
    defaults: {
      orientation: 'vertical',
      count: 1,
    },
  },

  {
    id: 'battery-aaa',
    name: 'AAA Battery',
    category: 'electronics',
    description: 'Standard AAA battery holder',
    thumbnail: '/templates/battery-aaa.png',
    shape: {
      type: 'cylinder',
      diameter: 11,  // 10.5mm + 0.5mm clearance
      height: 45,
    },
    configurableParams: [
      { key: 'orientation', label: 'Orientation', type: 'select', options: [
        { value: 'vertical', label: 'Vertical' },
        { value: 'horizontal', label: 'Horizontal' },
      ]},
      { key: 'count', label: 'Count', type: 'number', min: 1, max: 10, step: 1 },
    ],
    defaults: { orientation: 'vertical', count: 1 },
  },

  {
    id: 'sd-card',
    name: 'SD Card',
    category: 'electronics',
    description: 'Standard SD card slot with optional spring holder',
    thumbnail: '/templates/sd-card.png',
    shape: {
      type: 'box',
      width: 32.5,
      depth: 24.5,
      height: 3,
      fillet: 1,
    },
    configurableParams: [
      { key: 'springHolder', label: 'Spring Holder', type: 'boolean' },
      { key: 'count', label: 'Count', type: 'number', min: 1, max: 20, step: 1 },
    ],
    defaults: { springHolder: false, count: 1 },
  },

  {
    id: 'microsd',
    name: 'MicroSD Card',
    category: 'electronics',
    description: 'MicroSD card slot',
    thumbnail: '/templates/microsd.png',
    shape: {
      type: 'box',
      width: 15.5,
      depth: 11.5,
      height: 1.5,
      fillet: 0.5,
    },
    configurableParams: [
      { key: 'withAdapter', label: 'Include SD Adapter Slot', type: 'boolean' },
      { key: 'count', label: 'Count', type: 'number', min: 1, max: 30, step: 1 },
    ],
    defaults: { withAdapter: false, count: 1 },
  },

  {
    id: 'usb-a',
    name: 'USB-A Drive',
    category: 'electronics',
    description: 'USB-A flash drive slot',
    thumbnail: '/templates/usb-a.png',
    shape: {
      type: 'box',
      width: 12.5,
      depth: 5.5,
      height: 45,
    },
    configurableParams: [
      { key: 'length', label: 'Length (mm)', type: 'number', min: 30, max: 80, step: 5 },
      { key: 'count', label: 'Count', type: 'number', min: 1, max: 10, step: 1 },
    ],
    defaults: { length: 45, count: 1 },
  },

  {
    id: 'coin-cell-cr2032',
    name: 'CR2032 Coin Cell',
    category: 'electronics',
    description: 'CR2032 button cell holder (stackable)',
    thumbnail: '/templates/cr2032.png',
    shape: {
      type: 'cylinder',
      diameter: 20.5,
      height: 3.5,
    },
    configurableParams: [
      { key: 'stackCount', label: 'Stack Height', type: 'number', min: 1, max: 10, step: 1 },
      { key: 'columns', label: 'Columns', type: 'number', min: 1, max: 5, step: 1 },
    ],
    defaults: { stackCount: 5, columns: 1 },
  },
];
```

### Hardware Templates

```typescript
// src/features/generation/worker/templates/hardware.ts

export const hardwareTemplates: InsertTemplate[] = [
  {
    id: 'hex-nut-m3',
    name: 'M3 Hex Nut',
    category: 'hardware',
    description: 'M3 hex nut pocket (5.5mm AF)',
    thumbnail: '/templates/hex-nut-m3.png',
    shape: {
      type: 'hex',
      across_flats: 5.8,  // 5.5mm + clearance
      height: 2.7,        // 2.4mm + clearance
    },
    configurableParams: [
      { key: 'rows', label: 'Rows', type: 'number', min: 1, max: 10, step: 1 },
      { key: 'columns', label: 'Columns', type: 'number', min: 1, max: 10, step: 1 },
    ],
    defaults: { rows: 3, columns: 3 },
  },

  {
    id: 'screw-slot',
    name: 'Screw Slot',
    category: 'hardware',
    description: 'Configurable screw length slot',
    thumbnail: '/templates/screw-slot.png',
    shape: {
      type: 'slot',
      width: 4,      // Configurable via param
      length: 20,    // Configurable via param
      height: 10,
    },
    configurableParams: [
      { key: 'screwSize', label: 'Screw Size', type: 'select', options: [
        { value: 'm2', label: 'M2' },
        { value: 'm3', label: 'M3' },
        { value: 'm4', label: 'M4' },
        { value: 'm5', label: 'M5' },
      ]},
      { key: 'length', label: 'Screw Length (mm)', type: 'number', min: 4, max: 80, step: 2 },
      { key: 'count', label: 'Count', type: 'number', min: 1, max: 20, step: 1 },
    ],
    defaults: { screwSize: 'm3', length: 20, count: 5 },
  },

  {
    id: 'hex-key-holder',
    name: 'Hex Key Holder',
    category: 'hardware',
    description: 'Angled Allen key holder',
    thumbnail: '/templates/hex-key.png',
    shape: {
      type: 'custom',
      generator: 'hexKeyHolder',
    },
    configurableParams: [
      { key: 'sizes', label: 'Key Sizes', type: 'select', options: [
        { value: 'metric-small', label: 'Metric Small (1.5-6mm)' },
        { value: 'metric-full', label: 'Metric Full (1.5-10mm)' },
        { value: 'imperial', label: 'Imperial (1/16-3/8")' },
      ]},
    ],
    defaults: { sizes: 'metric-small' },
  },
];
```

---

## Error Handling

### WASM Failure Graceful Degradation

```typescript
// src/features/bin-designer/components/WasmErrorFallback.tsx

export function WasmErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />

      <h2 className="text-xl font-semibold mb-2">
        Unable to Load 3D Engine
      </h2>

      <p className="text-gray-400 mb-4 max-w-md">
        The 3D generation engine couldn't load. This might be due to:
      </p>

      <ul className="text-left text-gray-400 mb-6">
        <li>• Browser doesn't support WebAssembly</li>
        <li>• Not enough available memory</li>
        <li>• Network connection issues</li>
      </ul>

      <div className="flex gap-4">
        <Button onClick={() => window.location.reload()}>
          Try Again
        </Button>

        <Button variant="outline" asChild>
          <a href="https://gridfinity.xyz/models" target="_blank" rel="noopener">
            Browse Pre-Made STLs
          </a>
        </Button>
      </div>

      <details className="mt-8 text-sm text-gray-500">
        <summary className="cursor-pointer">Technical Details</summary>
        <pre className="mt-2 p-2 bg-gray-800 rounded text-left overflow-auto">
          {error.message}
        </pre>
      </details>
    </div>
  );
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// src/test/features/generation/binGenerator.test.ts

describe('BinGenerator', () => {
  it('generates valid mesh for standard bin', async () => {
    const params = createDefaultBinParams();
    const result = await engine.generateBin(params, new AbortController().signal, () => {});

    expect(result.mesh).toBeInstanceOf(ArrayBuffer);
    expect(result.mesh.byteLength).toBeGreaterThan(0);
  });

  it('supports half-bin dimensions', async () => {
    const params = createDefaultBinParams({ width: 1.5, depth: 2.5 });
    const result = await engine.generateBin(params, new AbortController().signal, () => {});

    expect(result.metadata.params.width).toBe(1.5);
    expect(result.metadata.params.depth).toBe(2.5);
  });

  it('cancels generation on abort', async () => {
    const controller = new AbortController();
    const params = createDefaultBinParams();

    const promise = engine.generateBin(params, controller.signal, () => {});
    controller.abort();

    await expect(promise).rejects.toThrow('AbortError');
  });
});
```

### Integration Tests

```typescript
// e2e/designer.spec.ts

test('full design and export flow', async ({ page }) => {
  await page.goto('/designer');

  // Wait for WASM to load
  await expect(page.getByText('Ready')).toBeVisible({ timeout: 30000 });

  // Set dimensions
  await page.getByLabel('Width').fill('2');
  await page.getByLabel('Depth').fill('3');
  await page.getByLabel('Height').fill('6');

  // Wait for preview to update
  await page.waitForTimeout(500);

  // Add dividers
  await page.getByLabel('X Dividers').fill('1');
  await page.getByLabel('Y Dividers').fill('2');

  // Export STL
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('button', { name: 'Download STL' }).click();

  // Verify download started
  const download = await page.waitForEvent('download');
  expect(download.suggestedFilename()).toMatch(/\.stl$/);
});
```

---

## Migration and Rollout

### Feature Flag

```typescript
// src/features/labs/definitions/features.ts

export const FEATURE_FLAGS = {
  // ... existing flags

  bin_designer: {
    id: 'bin_designer',
    name: 'Bin Designer',
    description: 'Parametric bin generation with replicad (beta)',
    defaultEnabled: false,  // Enable gradually
    category: 'experimental',
  },
};
```

### Route Configuration

```typescript
// src/App.tsx

const DesignerPage = lazy(() => import('@/features/bin-designer/components/DesignerPage'));

function App() {
  const binDesignerEnabled = useFeatureFlag('bin_designer');

  return (
    <Routes>
      <Route path="/" element={<LayoutPlanner />} />
      {binDesignerEnabled && (
        <Route
          path="/designer"
          element={
            <Suspense fallback={<DesignerLoadingScreen />}>
              <DesignerPage />
            </Suspense>
          }
        />
      )}
      {/* ... other routes */}
    </Routes>
  );
}
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-21 | AI Assistant | Initial architecture based on requirements gathering |
