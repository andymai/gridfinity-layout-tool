# Cutout Feature Implementation Plan

> **Feature:** Photo-based tool cutouts for bin designer (like tooltrace.io)
> **Architecture:** Clean Architecture with dedicated `cutouts` feature module
> **Status:** Ready for Implementation
> **Author:** Claude Code
> **Date:** 2026-02-03
> **Last Updated:** 2026-02-04 (Gap resolutions incorporated)

---

## Executive Summary

This document outlines the architecture and implementation plan for adding a photo-based cutout feature to the Gridfinity Layout Tool bin designer. Users will be able to photograph tools, trace their outlines automatically, and create custom bin cavities for organized tool storage.

### Key Decisions

| Aspect            | Decision                                           |
| ----------------- | -------------------------------------------------- |
| Input method      | Image tracing (photo upload)                       |
| Processing        | Client-side only (OpenCV.js, self-hosted chunk)    |
| Integration       | Cutouts belong to bins (extend Insert system)      |
| Depth model       | Uniform depth with slider                          |
| Output            | Integrated STL generation via CSG subtraction      |
| Library           | Personal cutout library (IndexedDB)                |
| UI                | New "Cutouts" tab with side-by-side layout         |
| Architecture      | Dedicated `src/features/cutouts/` module           |
| Scale persistence | Store `widthMm`/`heightMm` in CutoutTemplate       |
| Image storage     | Store original (~200KB) + thumbnail (~10KB)        |
| QR bridge         | New `api/cutout-image.ts` endpoint (Vercel Blob)   |
| Clearance         | Add `clearanceMm` to Insert (default 0.5mm)        |
| Rotation          | Full 0-359° support (migrated from 90° increments) |
| Mobile UX         | Desktop only v1 with helpful redirect message      |
| Position origin   | Top-left of bounding box                           |
| Duplicate names   | Auto-suffix (e.g., "Socket Wrench (2)")            |
| Overlap handling  | Allow overlaps, merge in CSG                       |
| Storage limits    | 100 cutouts, 20-30MB acceptable                    |

---

## Table of Contents

1. [Feature Requirements](#1-feature-requirements)
2. [Architecture Overview](#2-architecture-overview)
3. [Data Model](#3-data-model)
4. [Component Design](#4-component-design)
5. [File Structure](#5-file-structure)
6. [Implementation Phases](#6-implementation-phases)
7. [Testing Strategy](#7-testing-strategy)
8. [Performance Considerations](#8-performance-considerations)
9. [Error Handling](#9-error-handling)
10. [i18n Keys](#10-i18n-keys)
11. [UX/UI Design](#11-uxui-design)
12. [Generation Code](#12-generation-code)
13. [QR Bridge API](#13-qr-bridge-api)
14. [Future Extensibility](#14-future-extensibility)

---

## 1. Feature Requirements

### Core Workflow

1. **Upload Photo** — User uploads image of a tool (PNG/JPG)
2. **Auto-Trace** — OpenCV.js detects tool outline via contour detection
3. **Adjust** — User adjusts threshold slider if needed
4. **Scale** — User specifies one dimension (e.g., "tool is 150mm long")
5. **Place** — Cutout positioned in bin with move/rotate/scale
6. **Set Depth** — Uniform cut depth via slider
7. **Preview** — Real-time 3D preview with cutout cavity
8. **Export** — STL includes cutout geometry
9. **Save** — Optionally save cutout to personal library for reuse

### Constraints

- **One tool per photo** — Simplifies workflow
- **Non-technical users** — Prioritize simplicity
- **Uniform depth** — No continuous heightmaps (simplified from initial spec)
- **Backward compatible** — Existing layouts work unchanged
- **Client-side only** — No server processing, works offline after OpenCV loads
- **Desktop only (v1)** — Mobile users see helpful redirect message

### Editing Features (Core)

- Move (drag)
- Rotate (full 0-359° with Shift+drag for 15° snaps)
- Scale (maintain aspect ratio)
- Adjust depth (slider)
- Adjust clearance (default 0.5mm, customizable 0.2-2mm)
- Delete cutout

### Editing Features (Deferred to later)

- Point-by-point outline editing
- Mirror/flip
- Merge multiple cutouts
- Auto-arrange multiple cutouts

---

## 2. Architecture Overview

### Module Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                     Bin Designer                         │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐│    │
│  │  │Dimensions│ │  Base   │ │Compartm.│ │    Cutouts     ││    │
│  │  └─────────┘ └─────────┘ └─────────┘ │  (NEW TAB)      ││    │
│  │                                       │                 ││    │
│  │                                       │ ┌─────────────┐ ││    │
│  │                                       │ │ImageUploader│ ││    │
│  │                                       │ │TracingCtrls │ ││    │
│  │                                       │ │LibraryBrows.│ ││    │
│  │                                       │ └─────────────┘ ││    │
│  │                                       └─────────────────┘│    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
         │                                        │
         ▼                                        ▼
┌─────────────────────┐              ┌─────────────────────────────┐
│   bin-designer      │              │       cutouts (NEW)          │
│   store/designer.ts │◄─────────────│  hooks/useImageTracer.ts    │
│   addInsert()       │              │  hooks/useCutoutLibrary.ts  │
└─────────────────────┘              │  services/imageProcessor.ts │
         │                           │  services/opencvLoader.ts   │
         ▼                           │  storage/CutoutLibrary.ts   │
┌─────────────────────┐              └─────────────────────────────┘
│     generation      │                          │
│  binGenerator.ts    │◄─────────────────────────┘
│  buildInsertCuts()  │       (TracedContour data)
│  case 'traced'      │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│     STL Export      │
│  (cutout geometry)  │
└─────────────────────┘
```

### Data Flow

```
Photo Upload
    │
    ▼
┌───────────────────────────────────────────────────┐
│            cutouts/services/imageProcessor.ts      │
│  1. Load image to canvas                          │
│  2. Convert to grayscale (cv.cvtColor)            │
│  3. Gaussian blur (cv.GaussianBlur)               │
│  4. Threshold (cv.threshold)                      │
│  5. Find contours (cv.findContours)               │
│  6. Select largest contour                        │
│  7. Simplify (cv.approxPolyDP / Douglas-Peucker)  │
│  8. Normalize to 0-1 coordinates                  │
└───────────────────────────────────────────────────┘
    │
    ▼
TracedContour { points, boundingBox, area }
    │
    ├──► Save to Library (CutoutLibrary.ts → IndexedDB)
    │    - Store original image (~200KB)
    │    - Generate thumbnail (~10KB)
    │    - Store widthMm/heightMm for scale
    │
    ▼
CutoutsTab: "Place Cutout" button
    │
    ▼
addInsert({ shape: 'traced', contourPoints, cutDepth, clearanceMm, ... })
    │
    ▼
designer store → epoch++ → regeneration triggered
    │
    ▼
┌───────────────────────────────────────────────────┐
│         generation/binGenerator.ts                 │
│  buildInsertCuts() case 'traced':                 │
│  1. Scale points from 0-1 to absolute mm          │
│  2. Apply clearance offset                        │
│  3. Apply rotation (0-359°)                       │
│  4. Build brepjs path (draw().lineTo()...)        │
│  5. Extrude to cutDepth                           │
│  6. Return solid for cutAll()                     │
└───────────────────────────────────────────────────┘
    │
    ▼
CSG subtraction → MeshData → 3D Preview / STL Export
```

---

## 3. Data Model

### New Types (cutouts/types/index.ts)

```typescript
/**
 * A traced contour from image processing.
 * Points are normalized to 0-1 coordinates for scale-independence.
 */
export interface TracedContour {
  /** Contour points normalized to 0-1 range */
  readonly points: ReadonlyArray<{ readonly x: number; readonly y: number }>;
  /** Original aspect ratio (width/height) */
  readonly boundingBox: { readonly width: number; readonly height: number };
  /** Contour area (for validation) */
  readonly area: number;
}

/**
 * A saved cutout template in the personal library.
 */
export interface CutoutTemplate {
  readonly id: string;
  readonly name: string;
  readonly contour: TracedContour;
  readonly thumbnail: string | null; // ~10KB resized preview (base64)
  readonly originalImage: string | null; // ~200KB original photo (base64)
  readonly widthMm: number; // Real-world width in mm
  readonly heightMm: number; // Real-world height in mm
  readonly createdAt: string; // ISO timestamp
  readonly updatedAt: string; // ISO timestamp
  readonly category?: string; // e.g., "screwdriver", "wrench"
}

/**
 * Options for image processing.
 */
export interface ProcessingOptions {
  /** Threshold for binary conversion (0-255, default 128) */
  readonly threshold: number;
  /** Blur radius for noise reduction (0-10, default 3) */
  readonly blur: number;
  /** Minimum contour area in pixels (default 100) */
  readonly minContourArea: number;
  /** Douglas-Peucker simplification epsilon (default 0.005) */
  readonly simplificationEpsilon: number;
}

/**
 * Processing error types for user-friendly messages.
 */
export type ProcessingError =
  | { readonly type: 'opencv_load_failed'; readonly message: string }
  | { readonly type: 'no_contour_found'; readonly message: string }
  | { readonly type: 'invalid_image'; readonly message: string }
  | { readonly type: 'image_too_large'; readonly message: string };

/**
 * OpenCV loading progress state.
 */
export interface OpenCVLoadProgress {
  readonly stage: 'downloading' | 'initializing' | 'ready' | 'error';
  readonly progress: number; // 0-100
  readonly error?: string;
}
```

### Extended Types (bin-designer/types/index.ts)

```typescript
// Extend InsertShape union
export type InsertShape = 'rectangle' | 'circle' | 'hexagon' | 'rounded-rect' | 'slot' | 'traced';

// Extend Insert interface
export interface Insert {
  readonly id: string;
  readonly templateId: string | null;
  readonly shape: InsertShape;
  /** X position in mm from bin interior left edge */
  readonly x: number;
  /** Y position in mm from bin interior front edge */
  readonly y: number;
  /** Width in mm (or diameter for circle/hexagon) */
  readonly width: number;
  /** Depth in mm (ignored for circle/hexagon) */
  readonly depth: number;
  /** Cavity depth in mm (how deep the cut goes) */
  readonly cutDepth: number;
  /** Rotation in degrees (0-359) — CHANGED from 0|90|180|270 */
  readonly rotation: number;
  /** Corner radius for rounded-rect shape (mm) */
  readonly cornerRadius: number;
  /** Optional label for the insert */
  readonly label: string;
  /** For 'traced' shape: fit tolerance in mm (default 0.5) — NEW */
  readonly clearanceMm?: number;
  /** For 'traced' shape: reference to cutout template (optional) — NEW */
  readonly cutoutTemplateId?: string;
  /** For 'traced' shape: normalized contour points (0-1 coordinates) — NEW */
  readonly contourPoints?: ReadonlyArray<{
    readonly x: number;
    readonly y: number;
  }>;
}

// Add new tab
export type DesignerTab = 'dimensions' | 'base' | 'compartments' | 'walls' | 'style' | 'cutouts';
```

---

## 4. Component Design

### 4.1 OpenCV Loader Service

**File:** `src/features/cutouts/services/opencvLoader.ts`

```typescript
/**
 * Load OpenCV.js as a lazy chunk (self-hosted for PWA support).
 * Shows progress during download and initialization.
 */
export async function loadOpenCV(
  onProgress?: (progress: OpenCVLoadProgress) => void
): Promise<Result<void, ProcessingError>>;

/**
 * Check if OpenCV is already loaded.
 */
export function isOpenCVReady(): boolean;
```

### 4.2 Image Processor Service

**File:** `src/features/cutouts/services/imageProcessor.ts`

```typescript
/**
 * Trace contour from uploaded image.
 *
 * Algorithm:
 * 1. Load image to canvas
 * 2. Convert to grayscale
 * 3. Apply Gaussian blur
 * 4. Threshold to binary
 * 5. Find contours
 * 6. Select largest by area
 * 7. Simplify with Douglas-Peucker
 * 8. Normalize to 0-1 coordinates
 *
 * @param imageData - ImageData from canvas
 * @param options - Processing options (threshold, blur, etc.)
 * @returns TracedContour or error
 */
export async function traceImageContour(
  imageData: ImageData,
  options: ProcessingOptions
): Promise<Result<TracedContour, ProcessingError>>;
```

### 4.3 Thumbnail Generator Service

**File:** `src/features/cutouts/services/thumbnailGenerator.ts`

```typescript
/**
 * Generate a thumbnail from an original image.
 * Called on trace completion.
 *
 * @param originalDataUrl - Base64 data URL of original image
 * @param maxSize - Maximum dimension (default 200px)
 * @returns Base64 data URL of thumbnail (~10KB)
 */
export function generateThumbnail(originalDataUrl: string, maxSize?: number): Promise<string>;
```

### 4.4 Cutout Library Storage

**File:** `src/features/cutouts/storage/CutoutLibrary.ts`

```typescript
// Database: 'gridfinity-cutouts-v1'
// Store: 'templates'

export async function saveCutoutTemplate(
  template: Omit<CutoutTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Result<CutoutTemplate, StorageError>>;

export async function loadCutoutTemplates(): Promise<Result<CutoutTemplate[], StorageError>>;

export async function deleteCutoutTemplate(id: string): Promise<Result<void, StorageError>>;

export async function updateCutoutTemplate(
  id: string,
  updates: Partial<Omit<CutoutTemplate, 'id' | 'createdAt'>>
): Promise<Result<CutoutTemplate, StorageError>>;

/**
 * Generate unique name with auto-suffix if duplicate exists.
 * e.g., "Socket Wrench" → "Socket Wrench (2)" → "Socket Wrench (3)"
 */
export function generateUniqueName(baseName: string, existingNames: string[]): string;
```

**Constraints:**

- Max templates: 100
- Max contour points per template: 500
- Max storage: ~20-30MB (100 templates × 200-300KB each)

### 4.5 React Hooks

**File:** `src/features/cutouts/hooks/useImageTracer.ts`

```typescript
export function useImageTracer() {
  return {
    traceImage: (file: File, options: ProcessingOptions) => Promise<TracedContour | null>,
    isProcessing: boolean,
    error: string | null,
    opencvProgress: OpenCVLoadProgress | null,
  };
}
```

**File:** `src/features/cutouts/hooks/useCutoutLibrary.ts`

```typescript
export function useCutoutLibrary() {
  return {
    templates: CutoutTemplate[],
    isLoading: boolean,
    saveTemplate: (
      name: string,
      contour: TracedContour,
      originalImage: string | null,
      widthMm: number,
      heightMm: number
    ) => Promise<void>,
    deleteTemplate: (id: string) => Promise<void>,
  };
}
```

### 4.6 UI Components

**ImageUploader:** Drag-drop + file input for photo upload
**TracingControls:** Threshold and blur sliders
**LibraryBrowser:** Grid of saved cutout templates
**MobileRedirectMessage:** Helpful message for mobile users

### 4.7 CutoutsTab Integration

**File:** `src/features/bin-designer/components/CutoutsTab/CutoutsTab.tsx`

**Layout (Desktop ≥900px):**

```
┌─────────────────────────────────────────────────────────────┐
│ [Upload Image] [From Library]  [Trace Settings ▼]          │
├──────────────────────┬──────────────────────────────────────┤
│                      │                                      │
│   2D Canvas          │     3D Preview                       │
│   (traced tool)      │     (bin with cutout)                │
│                      │                                      │
├──────────────────────┴──────────────────────────────────────┤
│ Depth: [========|=====] 5mm   Clearance: [===|======] 0.5mm │
│                                                             │
│ [Save to Library]                          [Place Cutout]   │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. File Structure

### New Files to Create

```
src/features/cutouts/                          # NEW FEATURE MODULE
├── README.md                                  # Architecture documentation
├── index.ts                                   # Public exports
├── types/
│   └── index.ts                               # TracedContour, CutoutTemplate, etc.
├── assets/
│   └── sample-wrench.json                     # Bundled sample cutout for onboarding
├── services/
│   ├── opencvLoader.ts                        # PWA-compatible lazy loader
│   ├── opencvLoader.test.ts
│   ├── imageProcessor.ts                      # OpenCV.js wrapper
│   ├── imageProcessor.test.ts
│   ├── thumbnailGenerator.ts                  # Resize original to thumbnail
│   ├── thumbnailGenerator.test.ts
│   ├── contourSimplifier.ts                   # Douglas-Peucker
│   └── contourSimplifier.test.ts
├── storage/
│   ├── CutoutLibrary.ts                       # IndexedDB CRUD
│   ├── CutoutLibrary.test.ts
│   └── index.ts
├── hooks/
│   ├── useImageTracer.ts
│   ├── useImageTracer.test.ts
│   ├── useCutoutLibrary.ts
│   └── useCutoutLibrary.test.ts
├── utils/
│   ├── contourToPath.ts                       # Convert to SVG/brepjs
│   ├── contourToPath.test.ts
│   ├── boundsCalculator.ts
│   └── boundsCalculator.test.ts
└── components/
    ├── ImageUploader/
    │   ├── ImageUploader.tsx
    │   ├── ImageUploader.test.tsx
    │   └── index.ts
    ├── TracingControls/
    │   ├── TracingControls.tsx
    │   ├── TracingControls.test.tsx
    │   └── index.ts
    ├── LibraryBrowser/
    │   ├── LibraryBrowser.tsx
    │   ├── LibraryBrowser.test.tsx
    │   └── index.ts
    └── MobileRedirectMessage/
        ├── MobileRedirectMessage.tsx
        ├── MobileRedirectMessage.test.tsx
        └── index.ts

src/features/bin-designer/components/CutoutsTab/  # NEW TAB
├── CutoutsTab.tsx
├── CutoutsTab.test.tsx
├── CutoutsCanvas.tsx                          # 2D placement canvas
├── CutoutsCanvas.test.tsx
├── DepthControl.tsx
├── DepthControl.test.tsx
└── index.ts

api/
└── cutout-image.ts                            # QR bridge endpoint (Vercel Blob)
```

### Existing Files to Modify

| File                                                                 | Changes                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/features/bin-designer/types/index.ts`                           | Add `'traced'` to InsertShape, extend Insert, change rotation type |
| `src/features/bin-designer/components/DesignerPage/DesignerPage.tsx` | Register CutoutsTab                                                |
| `src/features/generation/worker/generators/binGenerator.ts`          | Add `'traced'` case with free rotation + clearance                 |
| `src/i18n/en.ts`                                                     | Add cutouts i18n keys                                              |
| `src/i18n/*.ts`                                                      | Add translations for all locales                                   |
| `vite.config.ts`                                                     | Add OpenCV.js as separate chunk for PWA caching                    |

---

## 6. Implementation Phases

### Phase 1: Core Infrastructure

**Goal:** Types, OpenCV loader, image processing, contour simplification, sample asset

**Tasks:**

- [ ] Create `src/features/cutouts/` directory structure
- [ ] Define types (`TracedContour`, `CutoutTemplate`, `ProcessingOptions`, `OpenCVLoadProgress`)
- [ ] Bundle OpenCV.js as lazy webpack chunk (update `vite.config.ts`)
- [ ] Implement `opencvLoader.ts` with progress callback
- [ ] Implement `imageProcessor.ts` with OpenCV.js
  - [ ] `traceImageContour()` - full pipeline
- [ ] Implement `contourSimplifier.ts` (Douglas-Peucker)
- [ ] Create `sample-wrench.json` asset for onboarding
- [ ] Implement `thumbnailGenerator.ts`
- [ ] Write unit tests for all services
- [ ] Create feature README.md

**Deliverable:** Can trace image and get contour data in console

### Phase 2: Storage Layer

**Goal:** IndexedDB persistence for cutout library with images

**Tasks:**

- [ ] Implement `CutoutLibrary.ts`
  - [ ] `saveCutoutTemplate()` - store original + thumbnail
  - [ ] `loadCutoutTemplates()`
  - [ ] `deleteCutoutTemplate()`
  - [ ] `updateCutoutTemplate()`
  - [ ] `generateUniqueName()` - auto-suffix for duplicates
- [ ] Add constraints (max 100 templates, max 500 points)
- [ ] Write storage tests

**Deliverable:** Templates persist across browser sessions

### Phase 3: Hooks & Components

**Goal:** React integration layer

**Tasks:**

- [ ] Implement `useImageTracer.ts` hook (with OpenCV progress)
- [ ] Implement `useCutoutLibrary.ts` hook
- [ ] Build `ImageUploader` component (drag-drop)
- [ ] Build `TracingControls` component (sliders)
- [ ] Build `LibraryBrowser` component (template grid)
- [ ] Build `MobileRedirectMessage` component
- [ ] Write component tests

**Deliverable:** Can upload image and see traced preview in standalone component

### Phase 4: Bin Designer Integration

**Goal:** Connect cutouts to bin designer with free rotation

**Tasks:**

- [ ] Extend `Insert` type with `'traced'` shape, `clearanceMm`, `contourPoints`
- [ ] Migrate `Insert.rotation` from `0|90|180|270` to `number` (0-359)
- [ ] Add `'cutouts'` to `DesignerTab` type
- [ ] Build `CutoutsTab` component
- [ ] Build `CutoutsCanvas` (2D placement with rotation knob)
  - [ ] Free rotation (0-359°)
  - [ ] Shift+drag for 15° snap increments
  - [ ] Double-click to reset to 0°
- [ ] Build `DepthControl` slider
- [ ] Register tab in DesignerPage
- [ ] Add mobile redirect message (desktop only v1)
- [ ] Add i18n strings

**Deliverable:** Can open cutouts tab and place traced shape in bin

### Phase 5: Generation Integration

**Goal:** CSG subtraction for traced shapes with clearance and free rotation

**Tasks:**

- [ ] Add `'traced'` case to `buildInsertCuts()`
- [ ] Implement clearance offset (default 0.5mm)
- [ ] Implement free rotation (0-359°) transformation
- [ ] Handle overlapping cutouts (merge in CSG)
- [ ] Write generation scenario tests
- [ ] Manual QA: export STL, verify in slicer

**Deliverable:** STL export includes cutout cavities

### Phase 6: QR Bridge API

**Goal:** Phone-to-desktop image transfer

**Tasks:**

- [ ] Create `api/cutout-image.ts` endpoint
- [ ] Integrate with Vercel Blob storage
- [ ] Add session-based cleanup (10 min expiry)
- [ ] Implement desktop polling
- [ ] Add QR code generation UI

**Deliverable:** Users can scan QR to upload from phone

### Phase 7: Polish & Documentation

**Goal:** Production-ready quality

**Tasks:**

- [ ] Add loading states (spinner during OpenCV load with progress)
- [ ] Add error toasts with user-friendly messages
- [ ] Implement keyboard shortcuts (Esc to cancel, R to rotate)
- [ ] Accessibility audit (ARIA labels, keyboard nav)
- [ ] Update CLAUDE.md with cutouts reference
- [ ] E2E test: full workflow
- [ ] E2E test: mobile redirect message
- [ ] Performance test: 500-point contour

**Deliverable:** Feature ready for production

---

## 7. Testing Strategy

### Unit Tests (Colocated)

| File                         | Tests                                        |
| ---------------------------- | -------------------------------------------- |
| `opencvLoader.test.ts`       | Progress callbacks, error handling, caching  |
| `imageProcessor.test.ts`     | Mock OpenCV, test threshold/blur variations  |
| `contourSimplifier.test.ts`  | Known shapes, point reduction                |
| `thumbnailGenerator.test.ts` | Resize quality, size limits                  |
| `CutoutLibrary.test.ts`      | CRUD, auto-suffix naming, max limits, errors |
| `useImageTracer.test.ts`     | State updates, error handling, progress      |
| `useCutoutLibrary.test.ts`   | Load, save, delete flows                     |

### Integration Tests

| Test                                   | Scope                                                   |
| -------------------------------------- | ------------------------------------------------------- |
| `binGenerator.scenario.traced.test.ts` | Full generation with traced insert, rotation, clearance |
| `CutoutsTab.test.tsx`                  | Upload → trace → place flow (mock OpenCV)               |

### E2E Tests (Playwright)

```typescript
// e2e/cutouts.spec.ts
test('cutout workflow', async ({ page }) => {
  // 1. Navigate to bin designer
  // 2. Open cutouts tab
  // 3. Upload test image (screwdriver.png)
  // 4. Wait for trace completion
  // 5. Adjust depth slider
  // 6. Click "Place Cutout"
  // 7. Verify 3D preview updates
  // 8. Export STL
  // 9. Verify file downloaded
});

test('cutout library', async ({ page }) => {
  // 1. Trace image
  // 2. Save to library
  // 3. Reload page
  // 4. Verify template persists
  // 5. Load from library
  // 6. Place cutout
});

test('mobile redirect message', async ({ page }) => {
  // 1. Set mobile viewport
  // 2. Navigate to cutouts tab
  // 3. Verify redirect message displays
  // 4. Verify upload controls hidden
});
```

---

## 8. Performance Considerations

### OpenCV.js Loading

- **Size:** ~8MB gzipped, ~30MB uncompressed
- **Strategy:** Self-hosted as lazy chunk for PWA caching
- **Progress:** Show download/initialization progress
- **Caching:** Module cached in service worker after first load
- **Fallback:** Show error if load fails, with retry option

### Image Processing

- **Target:** <2s for 1024×1024 image
- **Optimization:** Downscale images >2048px before processing
- **UX:** Show progress indicator during tracing
- **Debounce:** 300ms delay on slider changes

### Contour Simplification

- **Target:** ≤500 points per contour
- **Algorithm:** Douglas-Peucker with epsilon 0.005
- **Warning:** Show alert if point count exceeds threshold

### Generation Performance

- **Impact:** +20-50% generation time for traced shapes
- **Optimization:** CSG operations scale linearly with points
- **Warning:** Suggest simplification if >300 points

### Storage

- **IndexedDB:** ~200-300KB per template (original + thumbnail + contour)
- **Max capacity:** 100 templates × 300KB = ~30MB
- **Cleanup:** Warn user when approaching limit

---

## 9. Error Handling

### User-Friendly Messages

| Error                | Message                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| `opencv_load_failed` | "Failed to load image processing. Check your internet connection."                |
| `no_contour_found`   | "No tool outline detected. Try adjusting the threshold or using a clearer image." |
| `invalid_image`      | "Invalid image file. Please upload a PNG or JPG."                                 |
| `image_too_large`    | "Image is too large. Please use an image under 10MB."                             |

### Graceful Degradation

- **Invalid traced shape:** Skip in `buildInsertCuts()` (log warning, don't crash)
- **Storage full:** Warn user, suggest deleting old templates
- **OpenCV timeout:** Cancel after 10s, show retry option
- **Trace fallback:** Threshold adjustment only in v1 (no alternate algorithms)

---

## 10. i18n Keys

```typescript
// src/i18n/en.ts
cutouts: {
  title: 'Cutouts',
  uploadImage: 'Upload Image',
  uploadFromPhone: 'Upload from Phone',
  fromLibrary: 'From Library',
  traceSettings: 'Trace Settings',
  threshold: 'Threshold',
  thresholdHint: 'Lower values detect more detail',
  blur: 'Blur',
  blurHint: 'Reduce noise in the image',
  cutDepth: 'Cut Depth',
  clearance: 'Clearance',
  clearanceHint: 'Extra space around the tool for fit tolerance',
  clearanceCustomize: 'Customize',
  placeCutout: 'Place Cutout',
  saveToLibrary: 'Save to Library',
  libraryEmpty: 'No saved cutouts yet',
  deleteTemplate: 'Delete',
  renameTemplate: 'Rename',
  processing: 'Processing image...',
  loadingOpenCV: 'Loading image processor...',
  loadingProgress: 'Loading... {{progress}}%',
  noContourFound: 'No outline detected',
  adjustThreshold: 'Try adjusting the threshold',
  pointCount: '{{count}} points',
  simplifyWarning: 'Shape has many points. Consider simplifying.',
  enterDimension: 'Enter a known dimension',
  width: 'Width',
  height: 'Height',
  mm: 'mm',
  rotation: 'Rotation',
  rotationHint: 'Shift+drag for 15° snaps, double-click to reset',
  mobileTitle: 'Cutouts work best on desktop',
  mobileDescription: 'To add tool cutouts:\n1. Open this page on your computer\n2. Click "Upload from Phone"\n3. Scan the QR code with this device\n4. Take a photo of your tool\n\nYour photo will appear on your computer instantly!',
  mobileOpenDesktop: 'Open Desktop Instructions',
  qrTitle: 'Upload from Your Phone',
  qrDescription: 'Scan with your phone\'s camera to take a photo of your tool',
  qrWaiting: 'Waiting for photo...',
  qrCancel: 'Cancel',
}
```

---

## 11. UX/UI Design

> **Design Philosophy:** Reveal powerful features in an approachable, fun way. Prioritize intuitive interactions and delightful feedback moments.

### 11.1 User Journey Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CUTOUT USER JOURNEY                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ DISCOVER│───▶│ UPLOAD  │───▶│  TRACE  │───▶│  SCALE  │───▶│  PLACE  │  │
│  │         │    │         │    │         │    │         │    │         │  │
│  │ Open    │    │ Drag-   │    │ Watch   │    │ Ruler   │    │ Drag on │  │
│  │ Cutouts │    │ drop or │    │ magic   │    │ tool to │    │ 2D      │  │
│  │ tab     │    │ camera  │    │ happen  │    │ set mm  │    │ canvas  │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│       │              │              │              │              │        │
│       ▼              ▼              ▼              ▼              ▼        │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ Sample  │    │ Large   │    │ Animated│    │ Click-  │    │ Corner  │  │
│  │ cutout  │    │ drop    │    │ edge    │    │ drag    │    │ handles │  │
│  │ to try  │    │ zone +  │    │ detect  │    │ line on │    │ + rot.  │  │
│  │ first   │    │ camera  │    │ preview │    │ photo   │    │ knob    │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│                                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                                 │
│  │  DEPTH  │───▶│ CONFIRM │───▶│  SAVE   │                                 │
│  │         │    │         │    │         │                                 │
│  │ Slider  │    │ Animate │    │ Inline  │                                 │
│  │ + cross │    │ + "Add  │    │ name    │                                 │
│  │ section │    │ Another"│    │ input   │                                 │
│  └─────────┘    └─────────┘    └─────────┘                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Discovery & Empty State

**Entry Point:** New "Cutouts" tab in bin designer (alongside Dimensions, Base, etc.)

**First-Time Experience:**

- Pre-loaded **sample cutout** (wrench) for hands-on experimentation
- User can immediately drag, rotate, scale, and see 3D preview
- Gentle prompt: "Try moving this sample, then upload your own tool photo"

```
┌─────────────────────────────────────────────────────────────────┐
│  Cutouts                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │     🔧  Try this sample cutout!                          │  │
│  │                                                           │  │
│  │     Drag to move • Corner handles to resize              │  │
│  │     Rotation knob above to rotate                        │  │
│  │                                                           │  │
│  │     ─────────────────────────────────────────             │  │
│  │                                                           │  │
│  │     Ready for your own tools?                            │  │
│  │     [ Upload Photo ]  or  [ Take Photo 📷 ]              │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.3 Upload Experience

**Design:** Large, inviting drag-drop zone with camera option for mobile

**Interactions:**

- Drag file over zone → Zone highlights, "Drop to trace" appears
- Click zone → File picker opens
- Camera button (mobile) → Device camera opens directly

**Visual Feedback:**

- Dashed border animation on drag-over
- File type validation with friendly error if wrong type
- Size limit check (10MB max) with clear message

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  │                                                           │  │
│  │              📷                                           │  │
│  │                                                           │  │
│  │        Drop your tool photo here                         │  │
│  │                                                           │  │
│  │        or click to browse                                │  │
│  │                                                           │  │
│  │  ─────────────────────────────────────────────────────   │  │
│  │                                                           │  │
│  │        [ Take Photo 📱 ]  (mobile only)                  │  │
│  │                                                           │  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                                                 │
│  PNG, JPG up to 10MB • Best results: solid background          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.4 Tracing Animation ("Magic Moment")

**Design:** Animated edge detection preview showing processing stages

**Stages Visualized:**

1. Original photo appears
2. Grayscale overlay washes in
3. Edges highlight (glow effect)
4. Contour draws itself around the tool
5. Final outline pulses once, then settles

**Duration:** ~1-2 seconds total (feels magical, not slow)

**Fallback:** If processing takes >2s, show subtle progress ring

```
Stage 1          Stage 2          Stage 3          Stage 4
┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
│  🔧     │  ──▶ │  🔧     │  ──▶ │ ╭───╮   │  ──▶ │ ╭───╮   │
│ (color) │      │ (gray)  │      │ │🔧 │   │      │ │   │   │
│         │      │         │      │ ╰───╯   │      │ ╰───╯   │
└─────────┘      └─────────┘      └─────────┘      └─────────┘
  Original        Grayscale        Edges glow       Outline done
```

### 11.5 Result Presentation

**Design:** Traced outline overlaid on original photo with toggle

**Features:**

- Outline drawn in accent color (teal or amber) on photo
- "Show/Hide Outline" toggle for verification
- Threshold slider updates outline in real-time (live preview)

**Slider UX:**

- Drag threshold slider → Outline instantly redraws
- 300ms debounce on rapid changes
- Tooltip: "Lower = more detail, Higher = simpler shape"

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────────┐     │
│  │                                                        │     │
│  │              ╭─────────────╮                           │     │
│  │              │  🔧        │  ← Traced outline          │     │
│  │              │             │    on top of photo        │     │
│  │              ╰─────────────╯                           │     │
│  │                                                        │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
│  [ ] Show outline                      Threshold: [====|===]    │
│                                                                 │
│  Outline looks wrong? Adjust the threshold slider above.        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.6 Scaling (Ruler Tool)

**Design:** Click-and-drag ruler tool directly on the photo

**Interaction:**

1. User clicks starting point on photo
2. Drags to ending point (line draws in real-time)
3. Releases → Input field appears: "This distance is \_\_\_ mm"
4. User enters known measurement (e.g., tool length = 150mm)
5. System calculates scale factor

**Visual:**

- Ruler line with endpoint markers
- Measurement input appears inline at line midpoint
- Unit toggle: mm / inches (respects user locale preference)

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────────┐     │
│  │                                                        │     │
│  │              ╭─────────────╮                           │     │
│  │              │             │                           │     │
│  │    ●─────────┼─────────────┼──────●                   │     │
│  │    ▲         │             │      ▲                   │     │
│  │    │         ╰─────────────╯      │                   │     │
│  │    │                              │                   │     │
│  │    └────── This distance is: [150] mm ────────┘       │     │
│  │                                                        │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
│  Click and drag across a known dimension of your tool           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.7 Placement Canvas (2D + 3D Side-by-Side)

**Layout:** Left panel = 2D placement canvas, Right panel = Live 3D preview

**2D Canvas Features:**

- Bin outline shown as reference (dashed rectangle)
- Cutout draggable anywhere within canvas
- Corner handles for scaling (aspect ratio maintained)
- **Rotation knob above the cutout (circular handle)**
  - Full 0-359° rotation support
  - Shift+drag for 15° snap increments
  - Double-click to reset to 0°
- Grid snap optional (toggle in settings)
- Position origin: top-left of bounding box

**3D Preview:**

- Updates in real-time as cutout is moved
- Shows depth of cut as actual cavity
- Camera auto-frames to show cutout clearly

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Upload] [Library] [Settings ⚙]                                              │
├──────────────────────────────────┬──────────────────────────────────────────┤
│                                  │                                          │
│      2D Placement Canvas         │         3D Live Preview                  │
│                                  │                                          │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │    ┌──────────────────────────────┐      │
│  │                          │   │    │                              │      │
│  │          ◯ ← rotate      │   │    │     ╭────────────────╮       │      │
│  │       ╭─────╮            │   │    │     │   ┌────────┐   │       │      │
│  │       │     │            │   │    │     │   │ cutout │   │       │      │
│  │       │  🔧 │ ← cutout   │   │    │     │   │ cavity │   │       │      │
│  │       │     │            │   │    │     │   └────────┘   │       │      │
│  │       ╰─────╯            │   │    │     ╰────────────────╯       │      │
│  │    ■         ■ ← resize  │   │    │                              │      │
│  │                          │   │    └──────────────────────────────┘      │
│  │  ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄ ┄  │   │                                          │
│  │    bin boundary          │   │                                          │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │                                          │
│                                  │                                          │
├──────────────────────────────────┴──────────────────────────────────────────┤
│ Depth: [========|====] 5mm        Clearance: 0.5mm (auto) [Customize]       │
│                                                                             │
│ [ Save to Library ]                                      [ Place Cutout ✓ ] │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.8 Depth Control (Cross-Section Preview)

**Design:** Slider with animated 3D cross-section visualization

**Visualization:**

- Small side-view diagram showing tool profile sitting in cavity
- As depth slider moves, cavity depth animates
- Shows floor thickness remaining (safety indicator)

**Smart Defaults:**

- Default depth: 5mm (covers most hand tools)
- Max depth: bin height - 2mm (preserve floor)
- Warning if depth > 80% of bin height

```
┌─────────────────────────────────────────────────────────────────┐
│  Cut Depth                                                      │
│                                                                 │
│  [==========|========] 5mm                                      │
│                                                                 │
│  ┌────────────────────────────────────────────┐                │
│  │  Cross-Section View                        │                │
│  │                                            │                │
│  │  ╭──────────────────────────────────────╮  │                │
│  │  │          tool profile               │  │                │
│  │  │     ╭─────────────────────╮         │  │  ← cavity      │
│  │  │     │                     │         │  │    depth       │
│  │  │     │                     │         │  │                │
│  │  ├─────┴─────────────────────┴─────────┤  │  ← bin floor   │
│  │  └──────────────────────────────────────┘  │                │
│  └────────────────────────────────────────────┘                │
│                                                                 │
│  Floor remaining: 2mm ✓                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.9 Clearance (Smart Default)

**Design:** Auto-calculated with "Customize" option for power users

**Behavior:**

- Default: 0.5mm clearance added automatically
- Shown as subtle text: "Clearance: 0.5mm (auto)"
- "Customize" link reveals slider (0.2mm - 2mm range)

**Tooltip:** "Extra space around the tool so it fits easily. Increase if your printer has loose tolerances."

### 11.10 Library Browser (Layered Cards)

**Design:** Grid of cards showing photo + outline + size badge

**Card Anatomy:**

```
┌────────────────────────┐
│ ┌────────────────────┐ │
│ │                    │ │
│ │  [Original photo]  │ │  ← Photo as background
│ │   ╭────────────╮   │ │
│ │   │  outline   │   │ │  ← Traced outline overlay (semi-transparent)
│ │   ╰────────────╯   │ │
│ │                    │ │
│ └────────────────────┘ │
│ ┌──────┐               │
│ │ 10mm │  Socket 10mm  │  ← Size badge + name
│ └──────┘               │
└────────────────────────┘
```

**Interactions:**

- **Click** → Instantly place cutout in current bin
- **Hover** → Show full metadata (date, dimensions, point count)
- **Right-click / long-press** → Context menu (Rename, Delete)

**Search/Filter:**

- Search by name
- Sort by: Recent, Name, Size
- Future: Categories/tags

### 11.11 Error Recovery (Educational)

**Design:** Inline error message with visual tips and examples

**"No outline detected" error:**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ⚠️  No outline detected                                        │
│                                                                 │
│  Try these tips:                                                │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐                              │
│  │   ❌ Bad    │  │   ✓ Good   │                              │
│  │  [busy bg]  │  │ [solid bg] │                              │
│  │  [shadows]  │  │ [contrast] │                              │
│  └─────────────┘  └─────────────┘                              │
│                                                                 │
│  • Use a solid, contrasting background                         │
│  • Avoid shadows on the tool                                   │
│  • Try adjusting the threshold slider                          │
│                                                                 │
│  [ Try Again ] [ Adjust Threshold ]                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.12 Success Celebration

**Design:** Satisfying animation + prompt for next action

**Animation Sequence:**

1. Cutout "drops" into place in 3D view (subtle bounce)
2. Brief pulse/glow effect on the cutout
3. Confetti-style micro-animation (optional, subtle)
4. Prompt slides in from bottom

**Prompt:**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ✓ Cutout placed!                                              │
│                                                                 │
│  [ Add Another Cutout ]    [ Done - Back to Design ]           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.13 Mobile Experience

**Strategy:** Desktop only for v1, with helpful redirect message for mobile users

**Mobile users see:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Cutouts                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📱  Cutouts work best on desktop                              │
│                                                                 │
│  To add tool cutouts:                                          │
│                                                                 │
│  1. Open this page on your computer                            │
│  2. Click "Upload from Phone"                                  │
│  3. Scan the QR code with this device                          │
│  4. Take a photo of your tool                                  │
│                                                                 │
│  Your photo will appear on your computer instantly!            │
│                                                                 │
│  [ Open Desktop Instructions ]                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Desktop QR Bridge Flow:**

1. User clicks "Upload from Phone" in desktop app
2. QR code appears with unique session ID
3. User scans QR with phone camera
4. Phone opens upload page → takes/selects photo
5. Photo transfers instantly to desktop session (via Vercel Blob)
6. Desktop shows traced result, user continues editing

**QR Screen (Desktop):**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│           Upload from Your Phone                                │
│                                                                 │
│           ┌─────────────────────┐                              │
│           │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │                              │
│           │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │                              │
│           │ ▓▓▓▓  QR CODE  ▓▓▓ │                              │
│           │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │                              │
│           │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │                              │
│           └─────────────────────┘                              │
│                                                                 │
│           Scan with your phone's camera                        │
│           to take a photo of your tool                         │
│                                                                 │
│           Waiting for photo...                                 │
│                                                                 │
│           [ Cancel ]                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.14 Keyboard Shortcuts

| Shortcut                       | Action                              |
| ------------------------------ | ----------------------------------- |
| `R`                            | Rotate cutout 90° clockwise         |
| `Shift+R`                      | Rotate cutout 90° counter-clockwise |
| `Delete` / `Backspace`         | Delete selected cutout              |
| `Escape`                       | Cancel current operation / deselect |
| `Ctrl+Z` / `Cmd+Z`             | Undo                                |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo                                |

**Discoverability:** Shortcuts shown in tooltips (e.g., "Rotate (R)")

### 11.15 Multi-Cutout Management

**Design:** Collapsible list below canvas showing all cutouts

```
┌─────────────────────────────────────────────────────────────────┐
│  Placed Cutouts (3)                                    [▼]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────┐  Socket 10mm           5mm deep      [ 🗑 ] [ ⊕ ]     │
│  │ 🔧  │  10 × 15mm                                            │
│  └─────┘                                                        │
│                                                                 │
│  ┌─────┐  Screwdriver           8mm deep      [ 🗑 ] [ ⊕ ]     │
│  │ 🪛  │  25 × 150mm                                           │
│  └─────┘                                                        │
│                                                                 │
│  ┌─────┐  Pliers                6mm deep      [ 🗑 ] [ ⊕ ]     │
│  │ 🔧  │  45 × 180mm                                           │
│  └─────┘                                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Actions:**

- Click row → Select cutout on canvas (highlights)
- 🗑 → Delete (with undo via Ctrl+Z)
- ⊕ → Duplicate cutout

**Overlap Handling:** Overlapping cutouts are allowed and merged in CSG

### 11.16 Boundary Warnings

**Design:** Soft constraint with visual warning

**Behavior:**

- Cutout CAN be dragged outside bin boundaries
- When outside: outline turns red, warning appears
- "Place Cutout" button disabled while invalid

**Warning Message:** "Cutout extends beyond bin. Move it inside to place."

### 11.17 Visual Style Guidelines

**Colors:**

- Cutout outline: Teal (#14b8a6) or theme accent color
- Invalid state: Red (#ef4444)
- Success state: Green (#22c55e)
- Handles: White with dark border

**Animations:**

- All transitions: 200ms ease-out
- Hover effects: Scale 1.02
- Processing stages: 150ms per stage
- Success celebration: 400ms total

**Typography:**

- Match existing app styles
- Hints/tips: text-sm, text-secondary

---

## 12. Generation Code

### Free Rotation Implementation

The `buildInsertCuts()` function handles arbitrary rotation angles for traced shapes:

```typescript
case 'traced': {
  if (!insert.contourPoints || insert.contourPoints.length < 3) continue;

  // Apply clearance (default 0.5mm)
  const clearance = insert.clearanceMm ?? 0.5;

  // Scale and apply clearance to points
  const scaledPoints = insert.contourPoints.map(p => ({
    x: p.x * (insert.width + clearance * 2) - clearance,
    y: p.y * (insert.depth + clearance * 2) - clearance
  }));

  // Apply rotation around center
  const centerX = insert.width / 2;
  const centerY = insert.depth / 2;
  const radians = (insert.rotation * Math.PI) / 180;

  const rotatedPoints = scaledPoints.map(p => ({
    x: centerX + (p.x - centerX) * Math.cos(radians) - (p.y - centerY) * Math.sin(radians),
    y: centerY + (p.x - centerX) * Math.sin(radians) + (p.y - centerY) * Math.cos(radians)
  }));

  // Build path and extrude
  const path = draw();
  path.movePointerTo([rotatedPoints[0].x, rotatedPoints[0].y]);
  for (let i = 1; i < rotatedPoints.length; i++) {
    path.lineTo([rotatedPoints[i].x, rotatedPoints[i].y]);
  }
  path.close();

  solid = sketch(path, 'XY').extrude(insert.cutDepth);
  break;
}
```

### Key Implementation Notes

1. **Clearance Application:** Clearance is applied by expanding the bounding box before scaling, ensuring uniform offset around the entire contour.

2. **Rotation Order:** Rotation is applied after scaling but before position translation, rotating around the shape's center point.

3. **Overlap Handling:** Multiple cutouts with overlapping geometry are naturally merged by the CSG `cutAll()` operation — no special handling required.

4. **Backward Compatibility:** Existing non-traced inserts continue to use their original rotation values (0, 90, 180, 270). The migration to `number` type is non-breaking.

---

## 13. QR Bridge API

### Endpoint Design

**Endpoint:** `POST /api/cutout-image`

```typescript
// Request body
interface CutoutImageRequest {
  sessionId: string; // Generated by desktop, embedded in QR
  image: string; // Base64 data URL (max 10MB)
}

// Response
interface CutoutImageResponse {
  success: boolean;
  imageUrl?: string; // Vercel Blob URL (expires in 10 min)
  error?: string;
}
```

**Desktop polling:** `GET /api/cutout-image?sessionId=xxx`

```typescript
// Response
interface CutoutImagePollResponse {
  ready: boolean;
  imageUrl?: string; // Present when ready=true
}
```

### Implementation Notes

1. **Session Generation:** Desktop generates a random session ID (UUID v4) when opening the QR modal.

2. **QR Content:** QR encodes URL: `https://app.example.com/cutout-upload?session=xxx`

3. **Storage:** Images stored in Vercel Blob with 10-minute expiration.

4. **Polling:** Desktop polls every 2 seconds while QR modal is open.

5. **Cleanup:** Blob automatically expires; session metadata in KV expires after 15 minutes.

6. **Rate Limiting:** Standard API rate limits apply (100/min per IP).

---

## 14. Future Extensibility

### Phase 2+ Features (Deferred)

| Feature                | Architecture Impact                                      |
| ---------------------- | -------------------------------------------------------- |
| **Tiered depths**      | Extend `TracedContour` with depth map array              |
| **AI shape detection** | Add `services/aiDetector.ts`, cloud API                  |
| **Cloud library**      | Add `storage/CloudCutoutLibrary.ts` with Vercel Blob     |
| **SVG/DXF import**     | Add `services/vectorImporter.ts`                         |
| **Point editing**      | Add `components/ContourEditor/` with canvas manipulation |
| **Auto-arrange**       | Add `utils/packingAlgorithm.ts` for multiple cutouts     |

### Extension Points

1. **ProcessingOptions:** Add new fields for AI-based detection
2. **CutoutTemplate:** Add `source: 'traced' | 'imported' | 'ai'` field
3. **TracedContour:** Add optional `depthMap` for variable depth
4. **imageProcessor:** Export pipeline steps for custom processing

---

## Verification Plan

### Unit Tests

- `CutoutLibrary.test.ts`: CRUD, auto-suffix naming, storage limits
- `imageProcessor.test.ts`: Contour extraction, threshold variations
- `thumbnailGenerator.test.ts`: Resize quality, size limits

### Integration Tests

- `binGenerator.scenario.traced.test.ts`: Free rotation, clearance, CSG merge
- `CutoutsTab.test.tsx`: Full upload → trace → place flow

### E2E Tests

- Upload image, trace, set scale, place cutout, export STL
- Save to library, reload, load from library
- Mobile redirect message displays correctly

### Manual QA

- Verify PWA offline support (OpenCV cached)
- Test QR bridge flow desktop ↔ phone
- Import STL into slicer, verify cutout geometry

---

## Implementation Order

1. **Phase 1**: Core infrastructure + OpenCV lazy loading + sample asset
2. **Phase 2**: Storage layer with `originalImage` + thumbnail + auto-suffix
3. **Phase 3**: Hooks + components (adapted from base plan)
4. **Phase 4**: Bin designer integration + rotation migration
5. **Phase 5**: Generation integration with free rotation + clearance
6. **Phase 6**: QR bridge API endpoint
7. **Phase 7**: Polish, mobile message, E2E tests

---

_Document generated by Claude Code | Architecture: Clean | Status: Ready for Implementation_
