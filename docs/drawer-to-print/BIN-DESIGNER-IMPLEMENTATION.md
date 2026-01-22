# Bin Designer - Implementation Details

## Overview

**Purpose:** Supplementary technical specifications for AI coding agents
**Version:** 1.0
**Last Updated:** 2025-01-21

This document fills gaps in the PRD/Architecture/DRD with specific implementation decisions.

---

## Gridfinity Specification Reference

### Source of Truth

Use **Kennetek's gridfinity-rebuilt** as the canonical reference:
- **Repository:** https://github.com/kennetek/gridfinity-rebuilt-openscad
- **Key file:** `gridfinity-rebuilt-utility.scad` (all dimension constants)

### Key Dimensions from gridfinity-rebuilt

```typescript
// src/features/generation/constants/gridfinity.ts

export const GRIDFINITY = {
  // Base grid
  GRID_SIZE: 42,              // mm per 1x1 unit
  HEIGHT_UNIT: 7,             // mm per height unit

  // Tolerances
  TOLERANCE: 0.5,             // mm clearance for bin-to-baseplate fit

  // Base profile (from gridfinity-rebuilt)
  BASE_HEIGHT: 5,             // mm total base height
  BASE_BOTTOM_FILLET: 0.8,    // mm bottom edge radius
  BASE_TOP_FILLET: 2.15,      // mm top edge radius (stacking interface)

  // Stacking lip (matches gridfinity-rebuilt exactly)
  LIP_HEIGHT: 4.4,            // mm
  LIP_FILLET: 1.6,            // mm

  // Magnet holes
  MAGNET_DIAMETER: 6.5,       // mm (6mm magnet + tolerance)
  MAGNET_DEPTH: 2.4,          // mm (2mm magnet + tolerance)
  MAGNET_INSET: 4.8,          // mm from corner

  // Screw holes
  SCREW_DIAMETER: 3,          // mm (M3)
  SCREW_DEPTH: 6,             // mm

  // Walls
  WALL_THICKNESS: 1.2,        // mm default
  BOTTOM_THICKNESS: 0.7,      // mm (above base structure)

  // Fillets
  OUTER_FILLET: 3.75,         // mm on outer vertical edges
  INNER_FILLET: 1.6,          // mm on inner vertical edges
} as const;
```

### Base Hole Placement

Follow gridfinity-rebuilt's logic: **4 holes per 1x1 grid unit** (standard Gridfinity).

```typescript
// For a 2x3 bin, holes at:
// - Each corner of each 1x1 cell
// - Results in a grid pattern matching baseplate magnet positions

function calculateHolePositions(width: number, depth: number): Point[] {
  const holes: Point[] = [];
  const INSET = GRIDFINITY.MAGNET_INSET;

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < depth; y++) {
      const cellOrigin = { x: x * GRIDFINITY.GRID_SIZE, y: y * GRIDFINITY.GRID_SIZE };

      // 4 corners of each cell
      holes.push(
        { x: cellOrigin.x + INSET, y: cellOrigin.y + INSET },
        { x: cellOrigin.x + GRIDFINITY.GRID_SIZE - INSET, y: cellOrigin.y + INSET },
        { x: cellOrigin.x + INSET, y: cellOrigin.y + GRIDFINITY.GRID_SIZE - INSET },
        { x: cellOrigin.x + GRIDFINITY.GRID_SIZE - INSET, y: cellOrigin.y + GRIDFINITY.GRID_SIZE - INSET },
      );
    }
  }

  // Remove duplicates at cell boundaries
  return deduplicatePoints(holes);
}
```

---

## Bin Style Specifications

### Standard
- **Wall thickness:** 1.2mm
- **Bottom thickness:** 0.7mm (above base)
- **Internal ribbing:** None
- **Corner reinforcement:** None
- **Use case:** General purpose, balanced strength/material

### Lite
- **Wall thickness:** 0.8mm
- **Bottom thickness:** 0.5mm
- **Internal ribbing:** None
- **Corner reinforcement:** None
- **Use case:** Light items, faster print, less material
- **Note:** May show slight flex with heavy items

### Solid
- **Wall thickness:** 1.6mm
- **Bottom thickness:** Full (no hollow base)
- **Internal ribbing:** Cross-pattern on bottom interior
- **Corner reinforcement:** 2mm radius fillet reinforcement
- **Use case:** Heavy items, tools, metal parts

### Vase Mode
- **Wall thickness:** Single extrusion width (~0.4mm)
- **Bottom thickness:** 2-3 layers
- **Internal ribbing:** None (vase mode can't do internal features)
- **Corner reinforcement:** None
- **Use case:** Fastest possible print, decorative, very light items
- **Limitations:**
  - No dividers (vase mode constraint)
  - No inserts (vase mode constraint)
  - Label must be raised, not embossed

### Rugged
- **Wall thickness:** 2.0mm
- **Bottom thickness:** 1.5mm
- **Internal ribbing:** Honeycomb pattern on bottom
- **Corner reinforcement:** Triangular gussets at all vertical corners
- **Use case:** Workshop, garage, outdoor, drop-resistant
- **Note:** ~40% more material than Standard

---

## Label Font System

### Font Options (User Choice)

Bundle three fonts for label embossing:

1. **Inter** (default)
   - Modern, highly legible
   - Good for short labels
   - Bundle: Inter-Medium.woff2 (~25KB)

2. **JetBrains Mono**
   - Monospace, technical feel
   - Good for part numbers, codes
   - Bundle: JetBrainsMono-Medium.woff2 (~30KB)

3. **Archivo Black**
   - Bold, high contrast
   - Good for visibility at distance
   - Bundle: ArchivoBlack-Regular.woff2 (~20KB)

### Font Loading Strategy

```typescript
// Load font on-demand when label is enabled
async function loadLabelFont(fontId: 'inter' | 'jetbrains' | 'archivo'): Promise<ArrayBuffer> {
  const fontMap = {
    inter: '/fonts/Inter-Medium.woff2',
    jetbrains: '/fonts/JetBrainsMono-Medium.woff2',
    archivo: '/fonts/ArchivoBlack-Regular.woff2',
  };

  const cached = await caches.match(fontMap[fontId]);
  if (cached) return cached.arrayBuffer();

  const response = await fetch(fontMap[fontId]);
  const cache = await caches.open('designer-fonts-v1');
  cache.put(fontMap[fontId], response.clone());

  return response.arrayBuffer();
}
```

---

## 3MF Export Specification

### Minimal Metadata Approach

Export 3MF with model + thumbnail only. Let slicer handle print settings.

```typescript
interface ThreeMFExport {
  // Required
  model: ArrayBuffer;           // Mesh data
  thumbnail: Blob;              // PNG preview (128x128)

  // Metadata (informational only, not enforced)
  metadata: {
    title: string;              // Design name
    designer: 'Gridfinity Layout Tool';
    created: string;            // ISO date
    description: string;        // Generated description of params

    // Suggested settings (comments, not applied)
    suggestedLayerHeight: '0.2mm';
    suggestedInfill: '15%';
    suggestedMaterial: 'PLA';
  };
}
```

### Thumbnail Generation

Use dedicated lightweight renderer:

```typescript
// src/features/bin-designer/utils/thumbnailRenderer.ts

import { WebGLRenderer, Scene, PerspectiveCamera, DirectionalLight } from 'three';

class ThumbnailRenderer {
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: PerspectiveCamera;

  constructor() {
    // Small canvas, no antialiasing for speed
    this.renderer = new WebGLRenderer({
      canvas: new OffscreenCanvas(128, 128),
      antialias: false,
      preserveDrawingBuffer: true,
    });

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(45, 1, 0.1, 1000);
    this.camera.position.set(1, 1, 1).normalize().multiplyScalar(100);
    this.camera.lookAt(0, 0, 0);

    // Simple lighting
    const light = new DirectionalLight(0xffffff, 1);
    light.position.set(1, 2, 1);
    this.scene.add(light);
  }

  async render(mesh: BufferGeometry): Promise<Blob> {
    // Clear previous
    this.scene.children = this.scene.children.filter(c => c.type === 'DirectionalLight');

    // Add mesh
    const material = new MeshStandardMaterial({ color: 0xf59e0b }); // Amber
    const object = new Mesh(mesh, material);

    // Center and scale to fit
    const box = new Box3().setFromObject(object);
    const center = box.getCenter(new Vector3());
    object.position.sub(center);

    const size = box.getSize(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    this.camera.position.setLength(maxDim * 2);

    this.scene.add(object);
    this.renderer.render(this.scene, this.camera);

    return (this.renderer.domElement as OffscreenCanvas).convertToBlob({ type: 'image/png' });
  }
}

export const thumbnailRenderer = new ThumbnailRenderer();
```

---

## Error Handling Strategy

### Generation Failure Behavior

**"Show error + last good"** - Display error message but keep showing the last successful mesh.

```typescript
// src/features/bin-designer/store/designer.ts

interface GenerationState {
  status: 'idle' | 'generating' | 'complete' | 'error';

  // Always keep last successful mesh
  lastSuccessfulMesh: ArrayBuffer | null;
  lastSuccessfulParams: BinParams | null;

  // Current attempt
  currentMesh: ArrayBuffer | null;
  error: GenerationError | null;
}

interface GenerationError {
  code: 'INVALID_GEOMETRY' | 'WASM_CRASH' | 'TIMEOUT' | 'MEMORY';
  message: string;
  suggestion?: string;  // "Try reducing insert complexity"
  params: BinParams;    // Params that caused the error
}

// In UI: Show error toast, but preview shows lastSuccessfulMesh
```

---

## Analytics Events

### Match Existing ML Telemetry Patterns

Extend the existing `src/shared/analytics/useMLTracking.ts` patterns:

```typescript
// Designer-specific events

interface DesignerEvents {
  // Creation events (positive signals)
  design_created: {
    dimensions: { width: number; depth: number; height: number };
    style: BinStyle;
    features: {
      has_dividers: boolean;
      divider_count: number;
      has_scoop: boolean;
      has_label: boolean;
      has_inserts: boolean;
      insert_count: number;
    };
    base_type: BaseStyle;
    creation_method: 'from_scratch' | 'from_template' | 'from_preset' | 'forked';
  };

  design_exported: {
    format: 'stl' | 'step' | '3mf';
    quality?: 'draft' | 'standard' | 'high';
    batch_size: number;
    design_id_hash: string;  // Hashed, not raw ID
  };

  template_used: {
    template_id: string;
    category: 'electronics' | 'hardware' | 'tools';
    customized: boolean;
  };

  // Negative signals (user corrections)
  design_deleted: {
    age_seconds: number;      // How long design existed before deletion
    had_exports: boolean;     // Was it ever exported?
  };

  generation_failed: {
    error_code: string;
    params_hash: string;      // For debugging common failures
  };
}
```

---

## Insert Editor Specification

### Full Editor Capabilities

The insert editor supports:

1. **Primitives:** Rectangle, Circle, Hexagon, Rounded Rectangle
2. **Operations:**
   - Position via drag (snaps to 0.5mm grid)
   - Resize via handles (snaps to 0.5mm)
   - Rotation (15° increments)
   - Multi-select (Shift+click or drag box)
   - Copy/Paste (Ctrl+C/V)
   - Delete (Delete/Backspace)
   - Undo/Redo (Ctrl+Z/Y, same stack as main params)

### Smart Snapping Logic

```typescript
// src/features/bin-designer/utils/insertSnapping.ts

interface SnapResult {
  position: Point;
  snappedTo: 'grid' | 'edge' | 'other-insert' | 'center' | null;
}

function snapInsertPosition(
  insert: Insert,
  cursor: Point,
  binBounds: Rect,
  otherInserts: Insert[],
  gridSize: number = 0.5  // mm
): SnapResult {
  // Priority order:
  // 1. Snap to other insert edges (if within 2mm)
  // 2. Snap to bin center lines (if within 2mm)
  // 3. Snap to bin edges (if within 2mm)
  // 4. Snap to grid

  const SNAP_THRESHOLD = 2;  // mm

  // Check other insert alignment
  for (const other of otherInserts) {
    if (Math.abs(cursor.x - other.position.x) < SNAP_THRESHOLD) {
      return { position: { x: other.position.x, y: cursor.y }, snappedTo: 'other-insert' };
    }
    // ... check Y alignment, edges, etc.
  }

  // Check bin center
  const centerX = binBounds.width / 2;
  const centerY = binBounds.depth / 2;
  if (Math.abs(cursor.x - centerX) < SNAP_THRESHOLD) {
    return { position: { x: centerX, y: cursor.y }, snappedTo: 'center' };
  }

  // Default: snap to grid
  return {
    position: {
      x: Math.round(cursor.x / gridSize) * gridSize,
      y: Math.round(cursor.y / gridSize) * gridSize,
    },
    snappedTo: 'grid',
  };
}
```

### Insert Bounds Validation

**Smart snapping prevents invalid states.** If user tries to place insert outside bounds:

```typescript
function constrainInsertToBounds(insert: Insert, binBounds: Rect): Insert {
  const insertBounds = getInsertBounds(insert);

  // Clamp position to keep insert fully inside bin
  const maxX = binBounds.width - insertBounds.width;
  const maxY = binBounds.depth - insertBounds.height;

  return {
    ...insert,
    position: {
      x: Math.max(0, Math.min(insert.position.x, maxX)),
      y: Math.max(0, Math.min(insert.position.y, maxY)),
    },
  };
}
```

---

## Scoop Auto-Sizing Algorithm

### Smart Sizing Based on Compartment

```typescript
// src/features/generation/worker/generators/scoopGenerator.ts

interface ScoopParams {
  radius: number;     // mm
  depth: number;      // mm (how far into floor)
  angle: number;      // degrees (slope angle)
}

function calculateScoopParams(
  compartmentWidth: number,   // mm
  compartmentDepth: number,   // mm
  binHeight: number           // mm
): ScoopParams {
  const minDimension = Math.min(compartmentWidth, compartmentDepth);
  const aspectRatio = compartmentWidth / compartmentDepth;

  // Base radius: 1/3 of smallest dimension, capped
  let radius = Math.min(minDimension / 3, 15);  // Max 15mm radius

  // Adjust for aspect ratio - elongated compartments get shallower scoops
  if (aspectRatio > 2 || aspectRatio < 0.5) {
    radius *= 0.75;
  }

  // Depth: proportional to radius, but limited by bin height
  const depth = Math.min(radius * 0.6, binHeight * 0.3);

  // Angle: steeper for smaller compartments (easier finger access)
  const angle = minDimension < 20 ? 60 : 45;

  return { radius, depth, angle };
}
```

---

## Wall Cutout Constraints

### Minimum 20% Wall Height

```typescript
// src/features/bin-designer/utils/validation.ts

const WALL_CONSTRAINTS = {
  MIN_HEIGHT_PERCENT: 20,     // Minimum wall height for structural integrity
  WARNING_THRESHOLD: 30,      // Show warning below this
};

function validateWallCutouts(params: BinParams): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const [side, heightPercent] of Object.entries(params.walls)) {
    if (heightPercent < WALL_CONSTRAINTS.MIN_HEIGHT_PERCENT) {
      errors.push({
        field: `walls.${side}`,
        message: `${side} wall must be at least ${WALL_CONSTRAINTS.MIN_HEIGHT_PERCENT}%`,
        value: heightPercent,
        min: WALL_CONSTRAINTS.MIN_HEIGHT_PERCENT,
      });
    } else if (heightPercent < WALL_CONSTRAINTS.WARNING_THRESHOLD) {
      warnings.push({
        field: `walls.${side}`,
        message: `${side} wall at ${heightPercent}% may reduce structural integrity`,
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
```

---

## Resize with Inserts Behavior

### Scale Inserts Proportionally

When bin dimensions change, inserts scale proportionally:

```typescript
// src/features/bin-designer/store/designer.ts

function handleBinResize(
  oldParams: BinParams,
  newParams: BinParams,
  inserts: Insert[]
): Insert[] {
  const scaleX = newParams.width / oldParams.width;
  const scaleY = newParams.depth / oldParams.depth;

  return inserts.map(insert => ({
    ...insert,
    position: {
      x: insert.position.x * scaleX,
      y: insert.position.y * scaleY,
    },
    size: 'diameter' in insert.size
      ? { diameter: insert.size.diameter * Math.min(scaleX, scaleY) }
      : {
          width: insert.size.width * scaleX,
          height: insert.size.height * scaleY,
        },
    depth: insert.depth,  // Depth unchanged
  }));
}
```

**Note:** This may break template-specific dimensions (e.g., AA battery slot becomes wrong size). Consider showing a warning:

> "Resizing bin will scale inserts proportionally. Template-specific dimensions may need adjustment."

---

## Half-Bin Support

### Full Feature Support at 0.5 Units

All features work at 0.5 unit sizes:

```typescript
// Validation allows 0.5 increments
const DIMENSION_CONSTRAINTS = {
  width: { min: 0.5, max: 6, step: 0.5 },
  depth: { min: 0.5, max: 6, step: 0.5 },
  height: { min: 1, max: 12, step: 1 },  // Height still integer units
};

// Dividers work in any size (may result in tiny compartments)
// Scoops auto-size appropriately for small compartments
// Labels scale to fit available width
// Inserts can be placed in any size bin (may not fit)
```

---

## Bundle Size Budget

### Progressive Loading Strategy

```
Initial load (critical path):
├── Core UI components: <50KB gzip
├── React + Zustand: ~40KB gzip (shared with Layout Planner)
├── Three.js (preview): ~50KB gzip (lazy, after skeleton)
└── Total initial: <100KB

On-demand:
├── replicad WASM: ~3MB (lazy, cached in ServiceWorker)
├── Insert editor: ~30KB
├── Template library: ~20KB
├── Export dialogs: ~15KB
├── Font files: ~75KB total (loaded per-font)
└── Batch export worker: ~10KB
```

### Code Splitting Points

```typescript
// src/features/bin-designer/components/DesignerPage.tsx

// Core (loaded immediately)
import { ParameterPanel } from './ParameterPanel';
import { PreviewSkeleton } from './PreviewSkeleton';

// Lazy (loaded after initial render)
const PreviewCanvas = lazy(() => import('./PreviewCanvas'));
const InsertEditor = lazy(() => import('./InsertEditor'));
const TemplateLibrary = lazy(() => import('./TemplateLibrary'));
const ExportDialog = lazy(() => import('./ExportDialog'));
const BatchCart = lazy(() => import('./BatchCart'));
```

---

## Testing Strategy

### Real WASM in Tests

Use actual replicad WASM in Vitest tests (not mocks):

```typescript
// vitest.config.ts additions
export default defineConfig({
  test: {
    // Increase timeout for WASM tests
    testTimeout: 30000,

    // Pool configuration for WASM
    pool: 'forks',  // WASM doesn't work well with threads

    // Setup WASM before tests
    setupFiles: ['./src/test/setupWasm.ts'],
  },
});

// src/test/setupWasm.ts
import { initReplicad } from 'replicad';

let wasmInitialized = false;

beforeAll(async () => {
  if (!wasmInitialized) {
    await initReplicad();
    wasmInitialized = true;
  }
}, 30000);  // 30s timeout for WASM init
```

### Test Categories

1. **Unit tests (fast, no WASM):**
   - Parameter validation
   - Dimension calculations
   - Snap algorithms
   - State management

2. **Integration tests (with WASM):**
   - Bin generation produces valid mesh
   - Export formats are correct
   - Templates generate expected shapes

3. **E2E tests (Playwright):**
   - Full user flows
   - WASM loading experience
   - Export downloads

---

## Keyboard Shortcuts (Designer-Specific)

Completely separate set from Layout Planner:

```typescript
// src/features/bin-designer/constants/shortcuts.ts

export const DESIGNER_SHORTCUTS = {
  // General
  save: { key: 'ctrl+s', description: 'Save design' },
  export: { key: 'ctrl+e', description: 'Open export dialog' },
  share: { key: 'ctrl+shift+s', description: 'Share design' },

  // Undo/Redo
  undo: { key: 'ctrl+z', description: 'Undo' },
  redo: { key: 'ctrl+shift+z', description: 'Redo' },
  redoAlt: { key: 'ctrl+y', description: 'Redo (alt)' },

  // Preview controls
  resetView: { key: 'r', description: 'Reset camera view' },
  viewFront: { key: '1', description: 'Front view' },
  viewTop: { key: '2', description: 'Top view' },
  viewIso: { key: '3', description: 'Isometric view' },
  viewBack: { key: '4', description: 'Back view' },
  toggleWireframe: { key: 'w', description: 'Toggle wireframe' },

  // Insert editor (when focused)
  deleteInsert: { key: 'delete', description: 'Delete selected insert' },
  deleteInsertAlt: { key: 'backspace', description: 'Delete selected insert' },
  duplicateInsert: { key: 'ctrl+d', description: 'Duplicate selected insert' },
  selectAll: { key: 'ctrl+a', description: 'Select all inserts' },
  escape: { key: 'escape', description: 'Deselect / close dialog' },

  // Quick actions
  toggleScoop: { key: 's', description: 'Toggle scoop' },
  toggleLabel: { key: 'l', description: 'Toggle label' },
  addDividerX: { key: 'x', description: 'Add X divider' },
  addDividerY: { key: 'y', description: 'Add Y divider' },
} as const;
```

---

## Layout Planner Integration

### Full Integration with Bidirectional Sync

Designer bins appear in Layout Planner's bin palette with full drag-drop support:

```typescript
// src/features/layout-library/hooks/useCustomBins.ts

interface CustomBin {
  id: string;
  source: 'designer';
  name: string;
  params: BinParams;
  thumbnail: string;

  // Dimensions for palette display
  width: number;
  depth: number;
  height: number;

  // Link back to Designer
  designerId: string;
}

function useCustomBins() {
  // Listen for Designer saves
  useEffect(() => {
    const handleDesignerSave = (event: CustomEvent<SavedDesign>) => {
      const bin: CustomBin = {
        id: `designer:${event.detail.id}`,
        source: 'designer',
        name: event.detail.name,
        params: event.detail.params,
        thumbnail: event.detail.thumbnail,
        width: event.detail.params.width,
        depth: event.detail.params.depth,
        height: event.detail.params.height,
        designerId: event.detail.id,
      };

      addCustomBin(bin);
    };

    window.addEventListener('designer:save', handleDesignerSave);
    return () => window.removeEventListener('designer:save', handleDesignerSave);
  }, []);

  return { customBins, addCustomBin, removeCustomBin };
}
```

### Edit from Planner (Bidirectional)

Right-click a placed custom bin → "Edit in Designer":

```typescript
// Opens Designer with bin params loaded
function editInDesigner(bin: PlacedBin) {
  if (bin.customBinId?.startsWith('designer:')) {
    const designerId = bin.customBinId.replace('designer:', '');
    window.open(`/designer?edit=${designerId}`, '_blank');
  }
}

// Changes in Designer sync back to all placed instances
// (Last write wins - simple but may lose data in edge cases)
```

### Auto-Place Mode

"Use in Layout" button opens Planner in place mode:

```typescript
// Designer: trigger navigation
function useInLayout(design: SavedDesign) {
  const customBinId = `designer:${design.id}`;
  window.location.href = `/?place=${encodeURIComponent(customBinId)}`;
}

// Layout Planner: handle URL param
function usePlaceModeFromUrl() {
  const searchParams = new URLSearchParams(window.location.search);
  const placeId = searchParams.get('place');

  if (placeId) {
    // Enter place mode with this bin selected
    setInteractionMode('draw');
    setSelectedBinTemplate(placeId);

    // Clear URL param
    window.history.replaceState({}, '', '/');
  }
}
```

---

## Preset System

### Full Preset Support

Users can save any parameter subset as a reusable preset:

```typescript
// src/features/bin-designer/types/preset.ts

interface DesignPreset {
  id: string;
  name: string;
  createdAt: number;

  // Partial params - only non-default values
  params: Partial<BinParams>;

  // Which fields this preset sets
  appliesTo: (keyof BinParams)[];

  // User description
  description?: string;
}

// Example presets
const BUILT_IN_PRESETS: DesignPreset[] = [
  {
    id: 'heavy-duty-base',
    name: 'Heavy Duty Base',
    params: {
      base: { style: 'magnet', magnetDepth: 4, stackingLip: true },
      style: 'rugged',
    },
    appliesTo: ['base', 'style'],
    description: 'Magnet base with rugged walls for workshop use',
  },
  {
    id: 'quick-print',
    name: 'Quick Print',
    params: {
      style: 'lite',
      base: { style: 'standard', stackingLip: false },
    },
    appliesTo: ['style', 'base'],
    description: 'Minimal material, fastest print time',
  },
];
```

---

## Batch Export ZIP Structure

### User Choice of Structure

Export dialog offers folder structure options:

```typescript
type ZipStructure = 'flat' | 'by-design' | 'by-format';

// Flat: all files in root
// design1.stl, design2.stl, design3.stl, manifest.json

// By design: folder per design
// design1/model.stl, design1/model.step
// design2/model.stl, design2/model.step
// manifest.json

// By format: folder per format
// stl/design1.stl, stl/design2.stl
// step/design1.step, step/design2.step
// manifest.json
```

---

## Browser History Integration

### Per-Design History Entries

Loading a design adds a history entry:

```typescript
// src/features/bin-designer/hooks/useDesignerHistory.ts

function useDesignerHistory() {
  const { currentDesignId, loadDesign } = useDesignerStore();

  // Push state when design changes
  useEffect(() => {
    if (currentDesignId) {
      window.history.pushState(
        { designId: currentDesignId },
        '',
        `/designer?id=${currentDesignId}`
      );
    }
  }, [currentDesignId]);

  // Handle popstate (back/forward)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.designId) {
        loadDesign(event.state.designId);
      } else {
        // Back to new design state
        resetToDefaults();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [loadDesign]);
}
```

---

## Auto-Save Behavior

### Always Auto-Save (Like Google Docs)

Every change auto-saves after debounce:

```typescript
// src/features/bin-designer/hooks/useAutoSave.ts

function useAutoSave() {
  const params = useDesignerStore(state => state.params);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // Debounced save
  const debouncedParams = useDebouncedValue(params, 1000);  // 1s debounce

  useEffect(() => {
    const save = async () => {
      setSaveStatus('saving');
      try {
        await designerStorage.saveDesign({
          id: currentDesignId,
          params: debouncedParams,
          updatedAt: Date.now(),
        });
        setSaveStatus('saved');
      } catch (error) {
        setSaveStatus('error');
        console.error('Auto-save failed:', error);
      }
    };

    save();
  }, [debouncedParams]);

  return { saveStatus };
}
```

UI shows save status indicator:
- "Saving..." (brief flash)
- "Saved" (checkmark)
- "Save failed" (warning, with retry)

---

## Feature Flag Configuration

### Labs Toggle Only (No Percentage Rollout)

```typescript
// src/features/labs/definitions/features.ts

export const FEATURE_FLAGS = {
  // ... existing flags

  bin_designer: {
    id: 'bin_designer',
    name: 'Bin Designer',
    description: 'Create custom parametric Gridfinity bins with full control over dimensions, inserts, and features. Export to STL, STEP, or 3MF.',
    defaultEnabled: false,
    category: 'experimental',

    // No percentage rollout - users enable manually in Labs
    rollout: 'manual',
  },
};
```

Route guard:

```typescript
// src/App.tsx

function App() {
  const binDesignerEnabled = useFeatureFlag('bin_designer');

  return (
    <Routes>
      <Route path="/" element={<LayoutPlanner />} />

      {binDesignerEnabled ? (
        <Route path="/designer" element={<DesignerPage />} />
      ) : (
        <Route path="/designer" element={<Navigate to="/" replace />} />
      )}
    </Routes>
  );
}
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-21 | AI Assistant | Initial implementation details from requirements clarification |
