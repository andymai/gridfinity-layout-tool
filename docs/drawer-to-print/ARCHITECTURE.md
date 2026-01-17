# Drawer-to-Print System Architecture

## Overview

**Feature:** Drawer-to-Print STL Generation & Export System
**Version:** 1.0
**Status:** Planning
**Last Updated:** 2025-01-14

### Related Documents

| Document | Purpose | Link |
|----------|---------|------|
| **Product Requirements (PRD)** | User stories, acceptance criteria, success metrics | [PRD.md](./PRD.md) |
| **Design Requirements (DRD)** | UI/UX specifications, interaction patterns, accessibility | [DRD.md](./DRD.md) |
| **System Architecture** | This document - technical implementation | — |

---

## Vision

Transform the Gridfinity Layout Tool from a layout planner into a complete "one-stop shop" for drawer organization: input drawer dimensions, design your layout, and download a ZIP file with all STL files ready to print.

## Executive Summary

This document outlines the systems architecture for expanding the tool to support:
1. **Baseplate/Grid Generation** - GRIPS/GridPlates-style parametric baseplates sized to printer
2. **Parametric Bin Generation** - Generate STL files for bins with dividers, scoops, labels
3. **Bin Generator Library** - Multiple bin styles (standard, lite, specialty)
4. **Custom STL Import** - Upload, validate, and integrate custom models
5. **Export Package** - ZIP download with complete BOM and STL files

---

## Table of Contents

1. [Current Architecture](#current-architecture)
2. [Proposed Architecture](#proposed-architecture)
3. [Core Components](#core-components)
4. [Data Model Extensions](#data-model-extensions)
5. [STL Generation Strategy](#stl-generation-strategy)
6. [Custom Model System](#custom-model-system)
7. [Export Pipeline](#export-pipeline)
8. [Technology Recommendations](#technology-recommendations)
9. [Migration Path](#migration-path)
10. [Appendix: Research Sources](#appendix-research-sources)

---

## Current Architecture

### Strengths to Preserve

```
┌─────────────────────────────────────────────────────────────┐
│                    Current System                            │
├─────────────────────────────────────────────────────────────┤
│  Layout Store (Zustand)    →  Bins are pure dimensions      │
│  3D Preview (Three.js)     →  Procedural geometry exists    │
│  Print List (split.ts)     →  Smart splitting algorithm     │
│  Storage (IndexedDB)       →  50MB+ capacity available      │
│  Validation System         →  Collision/bounds checking     │
│  Result Type System        →  Robust error handling         │
└─────────────────────────────────────────────────────────────┘
```

**Key architectural decisions that support expansion:**
- **Bins are dimensional data only** - No geometry stored; perfect for parametric generation
- **Procedural 3D geometry** - `useBinGeometry.ts` already generates meshes from dimensions
- **Print optimization exists** - Splitting algorithm understands physical constraints
- **Robust storage layer** - Dual-write backend can handle large binary data
- **Strong type system** - Result types enable clean error handling for generation failures

### Current Gaps

| Gap | Impact | Solution Direction |
|-----|--------|-------------------|
| No STL I/O | Can't import/export real models | Add Three.js STLLoader + STLExporter |
| Single geometry style | All bins look identical | Add bin "style" discriminator |
| No model library | Can't select from templates | New ModelLibrary store |
| Parametric assumptions | Filament estimates assume uniform walls | Extend to handle mesh analysis |
| No baseplate concept | Grid is virtual only | Add baseplate generation |

---

## Proposed Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DRAWER-TO-PRINT SYSTEM                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │   Layout Store  │    │  Model Library  │    │ Generation Queue│     │
│  │  (bins, layers) │    │  (templates,    │    │  (async STL     │     │
│  │                 │◄──►│   custom STLs)  │◄──►│   generation)   │     │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘     │
│           │                      │                      │               │
│           ▼                      ▼                      ▼               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    GENERATION ENGINE                             │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │   │
│  │  │   Baseplate   │  │  Parametric   │  │    Custom     │        │   │
│  │  │   Generator   │  │ Bin Generator │  │  STL Resolver │        │   │
│  │  │   (JSCAD)     │  │   (JSCAD/     │  │  (validation  │        │   │
│  │  │               │  │   OpenSCAD)   │  │   + storage)  │        │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     EXPORT PIPELINE                              │   │
│  │  Layout Analysis → STL Collection → BOM Generation → ZIP Bundle │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Module Dependency Graph

```
src/
├── generation/                    # NEW: STL generation engine
│   ├── index.ts                   # Public API facade
│   ├── BaseplateGenerator.ts      # Baseplate/grid generation
│   ├── BinGenerator.ts            # Parametric bin generation
│   ├── GenerationQueue.ts         # Async job management
│   └── generators/                # Individual bin style generators
│       ├── StandardBin.ts
│       ├── LiteBin.ts
│       ├── DividedBin.ts
│       └── types.ts
│
├── models/                        # NEW: Model library system
│   ├── index.ts
│   ├── ModelLibrary.ts            # Zustand store for models
│   ├── CustomModelService.ts      # Upload, validate, store
│   ├── STLParser.ts               # Parse + analyze STL files
│   ├── STLExporter.ts             # Export geometry to STL
│   └── validation/
│       ├── GridCompatibility.ts   # Check Gridfinity compliance
│       └── MeshAnalysis.ts        # Bounding box, volume, etc.
│
├── export/                        # NEW: Export pipeline
│   ├── index.ts
│   ├── ExportService.ts           # Orchestrates full export
│   ├── BOMGenerator.ts            # Bill of materials
│   ├── ZipBuilder.ts              # JSZip wrapper
│   └── NamingStrategy.ts          # File naming conventions
│
├── store/                         # EXTENDED
│   └── models.ts                  # NEW: Model library store
│
└── types.ts                       # EXTENDED with new types
```

---

## Core Components

### 1. Generation Engine

The generation engine handles all STL creation, running in a Web Worker to avoid blocking the UI.

```typescript
// src/generation/types.ts

interface GenerationJob {
  id: string;
  type: 'baseplate' | 'bin' | 'custom';
  status: 'pending' | 'generating' | 'complete' | 'error';
  progress: number;           // 0-100
  params: GenerationParams;
  result?: GenerationResult;
  error?: string;
}

interface GenerationResult {
  stl: ArrayBuffer;           // Raw STL data
  metadata: {
    triangleCount: number;
    boundingBox: BoundingBox;
    volumeMm3: number;
    estimatedFilamentM: number;
    estimatedPrintTimeMin: number;
  };
}

// Baseplate generation params
interface BaseplateParams {
  gridX: number;              // Grid units wide
  gridY: number;              // Grid units deep
  style: 'weighted' | 'lite' | 'magnetic' | 'screw';
  magnetHoles: boolean;
  screwHoles: boolean;
  subdivisionsX?: number;     // For large baseplates that need splitting
  subdivisionsY?: number;
}

// Bin generation params
interface BinParams {
  width: number;              // Grid units
  depth: number;
  height: number;             // Height units (7mm each)
  style: BinStyle;
  dividers?: DividerConfig;
  scoop?: ScoopConfig;
  label?: LabelConfig;
  magnet?: MagnetConfig;
  lip?: LipStyle;
}

type BinStyle =
  | 'standard'    // Full Gridfinity spec bin
  | 'lite'        // Lightweight, faster print
  | 'solid'       // No internal features
  | 'vase'        // Vase mode compatible
  | 'custom';     // User-uploaded STL

interface DividerConfig {
  countX: number;             // Number of X divisions
  countY: number;             // Number of Y divisions
  style: 'full' | 'partial' | 'finger';
  height?: number;            // Divider height (default: full)
}

interface ScoopConfig {
  enabled: boolean;
  weight: number;             // 0-1, controls scoop depth
  sides: ('front' | 'back' | 'left' | 'right')[];
}

interface LabelConfig {
  enabled: boolean;
  style: 'full' | 'center' | 'left' | 'right' | 'none';
  angle?: number;             // Label tab angle
}
```

### 2. Model Library Store

New Zustand store for managing bin templates and custom models.

> **UI Reference:** See [DRD: Model Library Navigation](./DRD.md#6-model-library-navigation) for interaction patterns and visual specifications.

```typescript
// src/core/store/models.ts

interface ModelLibraryState {
  // Built-in parametric templates
  templates: BinTemplate[];

  // User-uploaded custom models
  customModels: CustomModel[];

  // Currently selected model for placement
  activeModelId: string | null;

  // Generation cache (avoid regenerating identical bins)
  cache: Map<string, CachedSTL>;
}

interface BinTemplate {
  id: string;
  name: string;
  description: string;
  category: 'standard' | 'specialty' | 'organization' | 'tool';
  thumbnail: string;          // Base64 preview
  defaultParams: Partial<BinParams>;
  parameterSchema: ParameterSchema;  // For UI generation
}

interface CustomModel {
  id: string;
  name: string;
  uploadedAt: string;
  source: 'file' | 'url' | 'cloud';

  // Analyzed properties
  gridSize: { width: number; depth: number; height: number };
  isGridCompatible: boolean;
  compatibilityWarnings: string[];

  // Storage
  stlData: ArrayBuffer;       // Stored in IndexedDB
  thumbnail: string;

  // Metadata
  originalFilename?: string;
  sourceUrl?: string;
  fileSize: number;
  triangleCount: number;
}

interface CachedSTL {
  paramsHash: string;         // Hash of generation params
  stl: ArrayBuffer;
  generatedAt: string;
  accessedAt: string;
}
```

### 3. Custom Model Service

Handles upload, validation, and storage of custom STL files.

> **PRD Reference:** Implements [US-4.1 through US-4.4](./PRD.md#epic-4-custom-model-import) (Custom Model Import epic)
> **UI Reference:** See [DRD: STL File Upload](./DRD.md#3-stl-file-upload) and [Grid Compatibility Validation](./DRD.md#4-grid-compatibility-validation) for interaction patterns.

```typescript
// src/models/CustomModelService.ts

interface CustomModelService {
  // Upload and analyze a custom STL
  importSTL(file: File): Promise<Result<CustomModel, ImportError>>;
  importFromURL(url: string): Promise<Result<CustomModel, ImportError>>;

  // Validation
  validateGridCompatibility(model: CustomModel): GridCompatibilityResult;
  suggestGridSize(boundingBox: BoundingBox): GridSize;

  // Storage
  saveModel(model: CustomModel): Promise<Result<void, StorageError>>;
  loadModel(id: string): Promise<Result<CustomModel, StorageError>>;
  deleteModel(id: string): Promise<Result<void, StorageError>>;

  // Preview generation
  generateThumbnail(stl: ArrayBuffer): Promise<string>;
}

interface GridCompatibilityResult {
  isCompatible: boolean;
  detectedSize: GridSize;
  warnings: CompatibilityWarning[];
  suggestions: CompatibilitySuggestion[];
}

type CompatibilityWarning =
  | { type: 'non-integer-size'; actual: number; nearest: number; axis: 'x' | 'y' | 'z' }
  | { type: 'no-stacking-lip'; message: string }
  | { type: 'no-base-profile'; message: string }
  | { type: 'oversized'; maxPrintBed: number; actual: number }
  | { type: 'manifold-error'; message: string };
```

### 4. Export Pipeline

Orchestrates the full export process from layout to downloadable ZIP.

> **PRD Reference:** Implements [US-5.1 through US-5.5](./PRD.md#epic-5-full-export-package) (Full Export Package epic)
> **UI Reference:** See [DRD: Export Flow](./DRD.md#5-export-flow) for the three-step modal interaction pattern.

```typescript
// src/export/types.ts

interface ExportOptions {
  // What to include
  includeBins: boolean;
  includeBaseplates: boolean;
  includeBOM: boolean;
  includeReadme: boolean;

  // Baseplate options
  baseplateStyle: 'weighted' | 'lite' | 'magnetic';
  baseplateSubdivision: 'none' | 'auto' | 'manual';

  // Bin options
  defaultBinStyle: BinStyle;
  defaultBinParams: Partial<BinParams>;

  // File options
  stlFormat: 'binary' | 'ascii';
  namingStyle: 'descriptive' | 'compact';
  organizeFolders: boolean;
}

interface ExportManifest {
  layout: {
    name: string;
    drawer: DrawerDimensions;
    totalBins: number;
    totalLayers: number;
  };

  files: ExportFile[];

  bom: BillOfMaterials;

  printEstimates: {
    totalFilamentM: number;
    totalPrintTimeHours: number;
    totalCost: number;
  };

  generatedAt: string;
  toolVersion: string;
}

interface ExportFile {
  path: string;               // e.g., "bins/3x2x4_standard.stl"
  type: 'baseplate' | 'bin';
  params: GenerationParams;
  quantity: number;
  filamentM: number;
  printTimeMin: number;
}

interface BillOfMaterials {
  baseplates: BOMEntry[];
  bins: BOMEntry[];
  hardware: HardwareEntry[];  // Magnets, screws if enabled
}

interface BOMEntry {
  description: string;
  size: string;
  quantity: number;
  stlFile: string;
  filamentM: number;
  printTimeMin: number;
  notes?: string;
}
```

---

## Data Model Extensions

### Extended Bin Type

```typescript
// Extend existing Bin interface in src/types.ts

interface Bin {
  // Existing fields...
  id: string;
  layerId: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  category: string;
  label: string;
  notes: string;
  clearanceHeight?: number;
  customProperties?: Record<string, string>;

  // NEW: Model/generation configuration
  modelConfig?: BinModelConfig;
}

interface BinModelConfig {
  // Source type
  type: 'parametric' | 'custom' | 'template';

  // For parametric bins
  params?: BinParams;

  // For custom STL bins
  customModelId?: string;

  // For template-based bins
  templateId?: string;
  templateOverrides?: Partial<BinParams>;

  // Generation state
  generationStatus?: 'pending' | 'cached' | 'error';
  cachedStlHash?: string;
}
```

### Extended Layout Type

```typescript
// Extend Layout in src/types.ts

interface Layout {
  // Existing fields...

  // NEW: Baseplate configuration
  baseplate?: BaseplateConfig;

  // NEW: Default generation settings
  generationDefaults?: GenerationDefaults;
}

interface BaseplateConfig {
  enabled: boolean;
  style: 'weighted' | 'lite' | 'magnetic' | 'screw' | 'none';
  magnetHoles: boolean;
  screwHoles: boolean;
  subdivisionStrategy: 'none' | 'auto' | 'manual';
  manualSubdivisions?: { x: number; y: number };
}

interface GenerationDefaults {
  binStyle: BinStyle;
  defaultDividers: DividerConfig;
  defaultScoop: ScoopConfig;
  defaultLabel: LabelConfig;
  defaultMagnet: MagnetConfig;
}
```

---

## STL Generation Strategy

### Decision: JSCAD vs OpenSCAD-WASM

| Criteria | JSCAD | OpenSCAD-WASM |
|----------|-------|---------------|
| Bundle size | ~200KB (modular) | ~15MB (full runtime) |
| Performance | Fast (native JS) | Slower (emulated) |
| Gridfinity support | Need to reimplement | Can use gridfinity-rebuilt directly |
| Learning curve | JavaScript-native | OpenSCAD language |
| Maintenance | Active community | Official port |
| Customization | Full control | Limited to OpenSCAD features |

**Recommendation: Hybrid Approach**

1. **JSCAD for simple bins** - Faster, smaller bundle, covers 80% of use cases
2. **OpenSCAD-WASM as optional advanced mode** - Lazy-loaded for complex bins that need gridfinity-rebuilt features

```typescript
// src/generation/BinGenerator.ts

class BinGenerator {
  private jscadEngine: JSCADEngine;
  private openscadEngine?: OpenSCADEngine;  // Lazy loaded

  async generate(params: BinParams): Promise<Result<ArrayBuffer, GenerationError>> {
    // Simple bins: use JSCAD
    if (this.canUseJSCAD(params)) {
      return this.jscadEngine.generate(params);
    }

    // Complex bins: lazy-load OpenSCAD
    if (!this.openscadEngine) {
      this.openscadEngine = await import('./OpenSCADEngine').then(m => new m.OpenSCADEngine());
    }
    return this.openscadEngine.generate(params);
  }

  private canUseJSCAD(params: BinParams): boolean {
    // JSCAD can handle:
    // - Standard rectangular bins
    // - Simple dividers (full height, evenly spaced)
    // - Basic scoops
    // - Label tabs

    // OpenSCAD needed for:
    // - Complex divider patterns
    // - Partial-height dividers
    // - Custom scoop profiles
    // - Advanced features from gridfinity-rebuilt

    const needsOpenSCAD =
      params.dividers?.style === 'finger' ||
      params.dividers?.height !== undefined ||
      (params.scoop?.weight ?? 0) !== 0 && (params.scoop?.weight ?? 0) !== 1;

    return !needsOpenSCAD;
  }
}
```

### JSCAD Bin Implementation Approach

```typescript
// src/generation/generators/StandardBin.ts (conceptual)

import { primitives, booleans, transforms } from '@jscad/modeling';

function generateStandardBin(params: BinParams): Geometry {
  const { width, depth, height } = params;
  const gridUnit = 42;  // mm
  const heightUnit = 7; // mm

  // External dimensions
  const extWidth = width * gridUnit;
  const extDepth = depth * gridUnit;
  const extHeight = height * heightUnit;

  // Wall thickness
  const wallThickness = 1.2;

  // 1. Create outer shell
  const outer = primitives.cuboid({
    size: [extWidth - 0.5, extDepth - 0.5, extHeight]  // 0.5mm tolerance
  });

  // 2. Create inner cavity
  const inner = primitives.cuboid({
    size: [extWidth - 0.5 - wallThickness * 2,
           extDepth - 0.5 - wallThickness * 2,
           extHeight - wallThickness]
  });
  const innerPositioned = transforms.translate([0, 0, wallThickness], inner);

  // 3. Boolean subtract
  let bin = booleans.subtract(outer, innerPositioned);

  // 4. Add Gridfinity base profile
  bin = addBaseProfile(bin, width, depth);

  // 5. Add stacking lip
  if (params.lip !== 'none') {
    bin = addStackingLip(bin, width, depth, extHeight);
  }

  // 6. Add dividers
  if (params.dividers) {
    bin = addDividers(bin, params.dividers, extWidth, extDepth, extHeight);
  }

  // 7. Add scoop
  if (params.scoop?.enabled) {
    bin = addScoop(bin, params.scoop, extWidth, extDepth, extHeight);
  }

  // 8. Add label tab
  if (params.label?.enabled) {
    bin = addLabelTab(bin, params.label, extWidth);
  }

  return bin;
}
```

### Generation Queue Architecture

```typescript
// src/generation/GenerationQueue.ts

class GenerationQueue {
  private worker: Worker;
  private jobs: Map<string, GenerationJob>;
  private subscribers: Set<(jobs: GenerationJob[]) => void>;

  constructor() {
    // Web Worker for non-blocking generation
    this.worker = new Worker(
      new URL('./generation.worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = this.handleWorkerMessage.bind(this);
  }

  async enqueue(params: GenerationParams): Promise<string> {
    const jobId = generateId();
    const job: GenerationJob = {
      id: jobId,
      type: this.getJobType(params),
      status: 'pending',
      progress: 0,
      params
    };

    this.jobs.set(jobId, job);
    this.worker.postMessage({ type: 'enqueue', job });
    this.notifySubscribers();

    return jobId;
  }

  async getResult(jobId: string): Promise<Result<GenerationResult, GenerationError>> {
    const job = this.jobs.get(jobId);
    if (!job) return err(generationError('NOT_FOUND', `Job ${jobId} not found`));
    if (job.status === 'error') return err(generationError('GENERATION_FAILED', job.error!));
    if (job.status !== 'complete') return err(generationError('NOT_READY', 'Still generating'));
    return ok(job.result!);
  }

  // Batch generation for export
  async generateAll(items: GenerationParams[]): AsyncIterable<GenerationProgress> {
    const jobIds = await Promise.all(items.map(p => this.enqueue(p)));

    for await (const update of this.watchJobs(jobIds)) {
      yield update;
    }
  }
}
```

---

## Custom Model System

### STL Import Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   File Drop  │────►│   Parse STL  │────►│   Analyze    │────►│   Validate   │
│   or URL     │     │   (Three.js) │     │   Geometry   │     │   Grid Fit   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                       │
                     ┌──────────────┐     ┌──────────────┐            │
                     │   Store in   │◄────│   Generate   │◄───────────┘
                     │   IndexedDB  │     │   Thumbnail  │
                     └──────────────┘     └──────────────┘
```

### Grid Compatibility Analysis

```typescript
// src/models/validation/GridCompatibility.ts

interface GridAnalysisResult {
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };

  dimensions: {
    widthMm: number;
    depthMm: number;
    heightMm: number;
  };

  gridFit: {
    width: number;    // Nearest grid units
    depth: number;
    height: number;   // Height units

    widthError: number;   // mm off from perfect fit
    depthError: number;
    heightError: number;
  };

  features: {
    hasStackingLip: boolean;      // Detected top lip geometry
    hasBaseProfile: boolean;      // Detected bottom profile
    hasMagnetHoles: boolean;      // Detected 6mm holes
    isWatertight: boolean;        // Manifold mesh
  };

  warnings: GridWarning[];

  confidence: 'high' | 'medium' | 'low';
}

function analyzeGridCompatibility(
  geometry: THREE.BufferGeometry
): GridAnalysisResult {
  // 1. Compute bounding box
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;

  // 2. Extract dimensions
  const widthMm = box.max.x - box.min.x;
  const depthMm = box.max.y - box.min.y;
  const heightMm = box.max.z - box.min.z;

  // 3. Calculate grid fit
  const gridUnit = 42;
  const heightUnit = 7;

  const gridWidth = Math.round(widthMm / gridUnit);
  const gridDepth = Math.round(depthMm / gridUnit);
  const gridHeight = Math.round(heightMm / heightUnit);

  // 4. Calculate errors
  const widthError = Math.abs(widthMm - gridWidth * gridUnit);
  const depthError = Math.abs(depthMm - gridDepth * gridUnit);
  const heightError = Math.abs(heightMm - gridHeight * heightUnit);

  // 5. Detect Gridfinity features (heuristic analysis)
  const features = detectGridfinityFeatures(geometry);

  // 6. Generate warnings
  const warnings = generateWarnings(/* ... */);

  return { /* ... */ };
}
```

### Custom Model Storage

```typescript
// Custom models stored in IndexedDB with separate object store

// Database schema extension
const DB_SCHEMA = {
  name: 'gridfinity-tool',
  version: 2,
  stores: {
    layouts: { keyPath: 'id' },        // Existing
    customModels: {                     // NEW
      keyPath: 'id',
      indexes: [
        { name: 'uploadedAt', keyPath: 'uploadedAt' },
        { name: 'gridSize', keyPath: 'gridSizeKey' }  // For filtering
      ]
    },
    stlCache: {                         // NEW: Generation cache
      keyPath: 'paramsHash',
      indexes: [
        { name: 'accessedAt', keyPath: 'accessedAt' }  // For LRU eviction
      ]
    }
  }
};

// Storage limits
const STORAGE_LIMITS = {
  maxCustomModels: 50,
  maxModelSizeMb: 20,
  maxCacheSizeMb: 100,
  cacheEvictionThreshold: 0.8  // Evict when 80% full
};
```

---

## Export Pipeline

### Export Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           EXPORT PROCESS                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. ANALYSIS                                                            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │ Collect all │───►│ Group by    │───►│ Calculate   │                 │
│  │ unique bins │    │ size/style  │    │ baseplates  │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
│                                                                         │
│  2. GENERATION (parallel in Web Worker)                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │ Generate    │    │ Generate    │    │ Resolve     │                 │
│  │ baseplates  │    │ param bins  │    │ custom STLs │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
│         │                  │                  │                         │
│         └──────────────────┼──────────────────┘                         │
│                            ▼                                            │
│  3. ASSEMBLY                                                            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │ Generate    │───►│ Create ZIP  │───►│ Add README  │                 │
│  │ BOM         │    │ structure   │    │ & manifest  │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
│                                                                         │
│  4. DELIVERY                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Download ZIP: drawer-name-YYYY-MM-DD.zip                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### ZIP Structure

```
my-drawer-2025-01-14.zip
├── README.md                    # Print instructions, drawer dimensions
├── manifest.json                # Machine-readable export manifest
├── bom.csv                      # Bill of materials for spreadsheet
│
├── baseplates/
│   ├── baseplate-10x8-weighted.stl
│   └── baseplate-10x8-weighted-section-A.stl  # If subdivided
│
├── bins/
│   ├── 1x1/
│   │   ├── 1x1x3-standard.stl
│   │   └── 1x1x4-standard.stl
│   ├── 2x2/
│   │   ├── 2x2x3-divided-2x2.stl
│   │   └── 2x2x4-standard.stl
│   ├── 3x2/
│   │   └── 3x2x5-scoop.stl
│   └── custom/
│       └── battery-holder-AA.stl    # Custom uploaded model
│
└── print-guide/
    ├── layer-1.png              # Visual layout reference
    ├── layer-2.png
    └── print-settings.md        # Recommended slicer settings
```

### BOM Generation

```typescript
// src/export/BOMGenerator.ts

interface BOMGeneratorOptions {
  includeFilament: boolean;
  includePrintTime: boolean;
  includeHardware: boolean;
  currency: string;
  filamentCostPerKg: number;
}

function generateBOM(
  layout: Layout,
  exportFiles: ExportFile[],
  options: BOMGeneratorOptions
): BillOfMaterials {
  const bins = groupBy(exportFiles.filter(f => f.type === 'bin'),
    f => `${f.params.width}x${f.params.depth}x${f.params.height}-${f.params.style}`);

  return {
    baseplates: exportFiles
      .filter(f => f.type === 'baseplate')
      .map(f => ({
        description: `Baseplate ${f.params.gridX}x${f.params.gridY}`,
        size: `${f.params.gridX}x${f.params.gridY}`,
        quantity: 1,
        stlFile: f.path,
        filamentM: f.filamentM,
        printTimeMin: f.printTimeMin
      })),

    bins: Object.entries(bins).map(([key, files]) => ({
      description: formatBinDescription(files[0].params),
      size: `${files[0].params.width}x${files[0].params.depth}x${files[0].params.height}`,
      quantity: files.reduce((sum, f) => sum + f.quantity, 0),
      stlFile: files[0].path,
      filamentM: files[0].filamentM,
      printTimeMin: files[0].printTimeMin,
      notes: files[0].params.label ? `Label: ${files[0].params.label}` : undefined
    })),

    hardware: options.includeHardware ? calculateHardware(layout, exportFiles) : []
  };
}
```

---

## Technology Recommendations

### Core Libraries

| Purpose | Library | Rationale |
|---------|---------|-----------|
| STL Generation | [@jscad/modeling](https://github.com/jscad/OpenJSCAD.org) | Modular, browser-native, fast |
| STL Export | [three/examples/jsm/exporters/STLExporter](https://threejs.org/docs/#examples/en/exporters/STLExporter) | Already using Three.js |
| STL Import | [three/examples/jsm/loaders/STLLoader](https://threejs.org/docs/#examples/en/loaders/STLLoader) | Already using Three.js |
| STL Analysis | [@amandaghassaei/stl-parser](https://www.npmjs.com/package/@amandaghassaei/stl-parser) | Bounding box, validation |
| ZIP Creation | [JSZip](https://github.com/Stuk/jszip) | Well-maintained, browser-native |
| File Download | [file-saver](https://github.com/eligrey/FileSaver.js) | Cross-browser saveAs |
| Advanced Generation | [openscad-wasm](https://github.com/openscad/openscad-wasm) | Optional, lazy-loaded |

### Bundle Size Impact

```
Current bundle (gzip):
  Main: ~106 KB
  Total: ~690 KB

Estimated additions:
  @jscad/modeling:     +80 KB (tree-shakeable)
  STLExporter:         +5 KB  (already in three chunk)
  JSZip:               +45 KB
  file-saver:          +3 KB
  openscad-wasm:       +15 MB (lazy, optional)

Projected total (without OpenSCAD): ~820 KB gzip
```

### Performance Considerations

1. **Web Workers** - All STL generation must run off main thread
2. **Streaming ZIP** - Use JSZip's streaming API for large exports
3. **Generation Cache** - LRU cache in IndexedDB to avoid regenerating
4. **Progressive UI** - Show individual file progress during export
5. **Lazy Loading** - OpenSCAD-WASM only loaded if needed

---

## Migration Path

> **Cross-Reference:** This migration path aligns with the [PRD Rollout Plan](./PRD.md#rollout-plan). Each phase corresponds to PRD epics and delivers specific user stories.

### Phase 1: Foundation (Non-breaking)

**Goal:** Add infrastructure without changing existing behavior

1. Add `modelConfig` field to Bin type (optional, backward compatible)
2. Create ModelLibrary store with empty default state
3. Add STL import/export utilities
4. Create generation service skeleton
5. Add JSCAD dependency and basic bin generator

**User Impact:** None - existing functionality unchanged

### Phase 2: Simple Bin Generation

**Goal:** Generate basic STL files for existing layouts

1. Implement StandardBin generator in JSCAD
2. Add "Export STL" button for individual bins
3. Create basic export modal with options
4. Implement single-bin STL download

**User Impact:** New optional feature

### Phase 3: Baseplate Generation

**Goal:** Generate baseplates sized to drawer

1. Implement baseplate generator
2. Add baseplate configuration to layout settings
3. Handle baseplate subdivision for large drawers
4. Include baseplates in export

**User Impact:** New configuration options

### Phase 4: Custom Model Import

**Goal:** Upload and use custom STL files

1. Implement STL parser and validator
2. Create custom model upload UI
3. Add grid compatibility analysis
4. Allow placing custom models as bins
5. Store custom models in IndexedDB

**User Impact:** Major new feature

### Phase 5: Advanced Bin Features

**Goal:** Support dividers, scoops, labels

1. Extend bin parameters UI
2. Implement divider generation
3. Implement scoop generation
4. Implement label tab generation
5. Add per-bin parameter overrides

**User Impact:** Enhanced customization

### Phase 6: Full Export Package

**Goal:** Complete drawer-to-print workflow

1. Implement full export pipeline
2. Create BOM generator
3. Add print guide generation
4. Create ZIP builder with folder structure
5. Add export progress UI

**User Impact:** Complete new workflow

### Phase 7: Optional Advanced Mode

**Goal:** OpenSCAD integration for power users

1. Lazy-load openscad-wasm
2. Integrate gridfinity-rebuilt templates
3. Add advanced parameter UI
4. Support complex divider patterns

**User Impact:** Optional advanced feature

---

## UI/UX Considerations

### New UI Components Needed

1. **Bin Style Picker** - Select bin type when placing
2. **Bin Parameters Panel** - Configure dividers, scoops, labels
3. **Model Library Browser** - Browse/search templates and custom models
4. **Custom Model Upload** - Drag-drop with validation feedback
5. **Export Modal** - Configure and monitor export progress
6. **Generation Progress** - Show STL generation status

### Integration Points

```
┌─────────────────────────────────────────────────────────────────┐
│  Header                                            [Export ▼]  │
├─────────────────────────────────────────────────────────────────┤
│         │                                │                      │
│ Sidebar │        Grid Canvas             │     Right Panel      │
│         │                                │  ┌────────────────┐  │
│ [Layers]│                                │  │ Bin Inspector  │  │
│         │                                │  │                │  │
│ [Models]│ ←── NEW: Model library tab     │  │ [Style: ▼]     │  │
│         │                                │  │ [Dividers...]  │  │
│         │                                │  │ [Scoop...]     │  │
│         │                                │  │ [Label...]     │  │
│         │                                │  │                │  │
│         │                                │  │ [Export STL]   │  │
│         │                                │  └────────────────┘  │
│         │                                │                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Bundle size bloat | Medium | Medium | Aggressive code splitting, lazy loading |
| STL generation too slow | Medium | High | Web Workers, caching, progress UI |
| Custom STL incompatibility | High | Medium | Robust validation, clear warnings |
| Browser memory limits | Low | High | Streaming export, chunked processing |
| OpenSCAD WASM complexity | Medium | Medium | Make it optional, JSCAD primary |
| IndexedDB quota exceeded | Low | Medium | Cache eviction, storage monitoring |

---

## Success Metrics

1. **Export success rate** > 99% - Exports complete without error
2. **Generation time** < 30s for typical drawer (20-50 bins)
3. **Custom model acceptance** > 80% of uploaded STLs validate successfully
4. **Bundle size** < 1MB gzip (excluding optional OpenSCAD)
5. **User satisfaction** - Feedback indicates workflow improvement

---

## Appendix: Research Sources

### Gridfinity Specification
- [Gridfinity Official Specification](https://gridfinity.xyz/specification/)
- [Gridfinity Unofficial Wiki](https://gridfinity.xyz/)
- [gridfinity-unofficial/specification (GitHub)](https://github.com/gridfinity-unofficial/specification)

### STL Generation Libraries
- [JSCAD/OpenJSCAD.org (GitHub)](https://github.com/jscad/OpenJSCAD.org)
- [OpenSCAD-WASM (GitHub)](https://github.com/openscad/openscad-wasm)
- [gridfinity-rebuilt-openscad (GitHub)](https://github.com/kennetek/gridfinity-rebuilt-openscad)
- [Building an OpenSCAD WASM Configurator](https://schroer.ca/2022/03/20/openscad-configurator/)

### STL Parsing
- [@amandaghassaei/stl-parser (npm)](https://www.npmjs.com/package/@amandaghassaei/stl-parser)
- [Three.js STLLoader](https://threejs.org/docs/#examples/en/loaders/STLLoader)

### ZIP Generation
- [JSZip (GitHub)](https://github.com/Stuk/jszip)
- [JSZip Documentation](https://stuk.github.io/jszip/)

### Existing Gridfinity Generators
- [Gridfinity Generator (perplexinglabs)](https://gridfinity.perplexinglabs.com/)
- [Gridfinity Creator (bouwens.co)](https://gridfinity.bouwens.co/)
- [gridfinity.tools](https://gridfinity.tools/)

---

*Document created: 2025-01-14*
*Status: Architecture Plan - Not Implemented*
