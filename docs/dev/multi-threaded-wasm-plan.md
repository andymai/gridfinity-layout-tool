# Multi-Threaded WASM Implementation Plan

## Overview

Enable multi-threaded OpenCascade WASM to achieve **2-3x faster bin generation** for complex geometries through parallel boolean operations and tessellation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    gridfinity-layout-tool                       │
├─────────────────────────────────────────────────────────────────┤
│  Browser                                                        │
│  ┌──────────────┐    ┌─────────────────────────────────────┐   │
│  │ Main Thread  │───▶│ Generation Worker                   │   │
│  │              │    │  ┌─────────────────────────────────┐│   │
│  │ React UI     │    │  │ OpenCascade WASM (multi-thread) ││   │
│  │              │    │  │  ┌─────┐ ┌─────┐ ┌─────┐       ││   │
│  │              │    │  │  │ T1  │ │ T2  │ │ T3  │ ...   ││   │
│  │              │◀───│  │  └─────┘ └─────┘ └─────┘       ││   │
│  │              │    │  └─────────────────────────────────┘│   │
│  └──────────────┘    └─────────────────────────────────────┘   │
│         ▲                          │                            │
│         │ SharedArrayBuffer        │ pthread workers            │
│         └──────────────────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

## Phase 1: brepjs Repository Changes

### 1.1 Create Multi-Threaded Build Config

**File:** `~/Git/brepjs/packages/brepjs-opencascade/build-source/custom_build_threaded.yml`

```yaml
#@ load("defaults.yml", "bindings", "emccFlags", "additionalCppCode")

mainBuild:
  name: brepjs_threaded.js
  bindings: #@ bindings()
  emccFlags:
    #@ for flag in emccFlags():
    -  #@ flag
    #@ end
    - -pthread
    - -sPTHREAD_POOL_SIZE=navigator.hardwareConcurrency
    - -sSHARED_MEMORY=1
    - -sINITIAL_MEMORY=134217728
    - -sMAXIMUM_MEMORY=4294967296
additionalCppCode: #@ additionalCppCode()
```

### 1.2 Update Package Scripts

**File:** `~/Git/brepjs/packages/brepjs-opencascade/package.json`

Add new build script:

```json
{
  "scripts": {
    "buildWasm": "pnpm run generateConfig && pnpm run buildSingle && pnpm run buildWithExceptions && pnpm run buildThreaded",
    "buildThreaded": "cd build-config && docker run -it --rm -v $(pwd):/src -u $(id -u):$(id -g) donalffons/opencascade.js custom_build_threaded.yml && mv brepjs_threaded* ../src && cd -"
  }
}
```

### 1.3 Update Package Exports

**File:** `~/Git/brepjs/packages/brepjs-opencascade/package.json`

Add exports for both variants:

```json
{
  "main": "src/brepjs_single.js",
  "exports": {
    ".": "./src/brepjs_single.js",
    "./single": "./src/brepjs_single.js",
    "./threaded": "./src/brepjs_threaded.js",
    "./src/*": "./src/*"
  },
  "files": ["src"]
}
```

### 1.4 Update GitHub Workflow

**File:** `~/Git/brepjs/.github/workflows/publish-opencascade.yml`

Add threaded build step:

```yaml
- name: Build threaded
  working-directory: packages/brepjs-opencascade/build-config
  run: |
    docker run -i --rm -v $(pwd):/src donalffons/opencascade.js custom_build_threaded.yml
    mv brepjs_threaded* ../src/
```

### 1.5 Build and Publish

```bash
cd ~/Git/brepjs/packages/brepjs-opencascade
pnpm run buildWasm
# Bump version to 0.4.0
npm version minor
npm publish
```

---

## Phase 2: gridfinity-layout-tool Changes

### 2.1 Add COOP/COEP Headers (Vercel)

**File:** `vercel.json`

Add global headers for SharedArrayBuffer support:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" }
      ]
    }
    // ... existing headers
  ]
}
```

**Note:** Using `credentialless` instead of `require-corp` for better third-party compatibility (PostHog, Google Fonts).

### 2.2 Add COOP/COEP Headers (Vite Dev)

**File:** `vite.config.ts`

```typescript
export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  // ... rest of config
});
```

### 2.3 Create Capability Detection Utility

**File:** `src/features/generation/utils/wasmCapabilities.ts`

```typescript
/**
 * WASM capability detection for multi-threading support.
 */

export interface WasmCapabilities {
  readonly supportsThreads: boolean;
  readonly hardwareConcurrency: number;
  readonly crossOriginIsolated: boolean;
}

let cachedCapabilities: WasmCapabilities | null = null;

export function detectWasmCapabilities(): WasmCapabilities {
  if (cachedCapabilities) return cachedCapabilities;

  const crossOriginIsolated =
    typeof self !== 'undefined' &&
    'crossOriginIsolated' in self &&
    self.crossOriginIsolated === true;

  const supportsThreads =
    crossOriginIsolated &&
    typeof SharedArrayBuffer !== 'undefined' &&
    typeof Atomics !== 'undefined';

  const hardwareConcurrency =
    typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4;

  cachedCapabilities = { supportsThreads, hardwareConcurrency, crossOriginIsolated };
  return cachedCapabilities;
}

export function canUseThreadedWasm(): boolean {
  return detectWasmCapabilities().supportsThreads;
}
```

### 2.4 Update Worker Initialization

**File:** `src/features/generation/worker/generation.worker.ts`

```typescript
import { setOC, registerQueryModule, EdgeFinder, FaceFinder } from 'brepjs';
import type { WorkerMessage, WorkerResponse } from '../bridge/types';
import { canUseThreadedWasm, detectWasmCapabilities } from '../utils/wasmCapabilities';

let ocInitialized = false;
let isThreaded = false;

async function initOpenCascade(): Promise<{ isThreaded: boolean; cores: number }> {
  const capabilities = detectWasmCapabilities();
  const useThreaded = canUseThreadedWasm();

  let OC: OpenCascadeInstance;

  if (useThreaded) {
    // Dynamic import of threaded build
    const [{ default: opencascade }, { default: wasmUrl }, { default: workerUrl }] =
      await Promise.all([
        import('brepjs-opencascade/src/brepjs_threaded.js'),
        import('brepjs-opencascade/src/brepjs_threaded.wasm?url'),
        import('brepjs-opencascade/src/brepjs_threaded.worker.js?url'),
      ]);

    OC = await opencascade({
      locateFile: (fileName: string) => {
        if (fileName.endsWith('.wasm')) return wasmUrl;
        if (fileName.endsWith('.worker.js')) return workerUrl;
        return fileName;
      },
    });
    isThreaded = true;
  } else {
    // Fallback to single-threaded build
    const [{ default: opencascade }, { default: wasmUrl }] = await Promise.all([
      import('brepjs-opencascade/src/brepjs_single.js'),
      import('brepjs-opencascade/src/brepjs_single.wasm?url'),
    ]);

    OC = await opencascade({
      locateFile: (fileName: string) => {
        if (fileName.endsWith('.wasm')) return wasmUrl;
        return fileName;
      },
    });
    isThreaded = false;
  }

  setOC(OC);
  registerQueryModule({ EdgeFinder, FaceFinder });
  ocInitialized = true;

  return { isThreaded, cores: capabilities.hardwareConcurrency };
}

// Update INIT_READY response
respond({
  type: 'INIT_READY',
  isThreaded,
  hardwareConcurrency: capabilities.hardwareConcurrency,
});
```

### 2.5 Update Bridge Types

**File:** `src/features/generation/bridge/types.ts`

```typescript
export interface InitReadyResponse {
  readonly type: 'INIT_READY';
  readonly isThreaded: boolean;
  readonly hardwareConcurrency: number;
}
```

### 2.6 Update GenerationBridge

**File:** `src/features/generation/bridge/GenerationBridge.ts`

```typescript
export interface InitResult {
  readonly isThreaded: boolean;
  readonly hardwareConcurrency: number;
}

export class GenerationBridge {
  private initResult: InitResult | null = null;

  init(): Promise<InitResult> {
    // ... existing init logic
    // Store and return threading info from INIT_READY
  }

  get isThreaded(): boolean {
    return this.initResult?.isThreaded ?? false;
  }
}
```

### 2.7 Add Analytics Tracking

**File:** `src/features/bin-designer/hooks/useGeneration.ts`

```typescript
bridge.init().then(({ isThreaded, hardwareConcurrency }) => {
  trackEvent('wasm_initialized', {
    is_threaded: isThreaded,
    hardware_concurrency: hardwareConcurrency,
  });
});
```

---

## Phase 3: Testing & Validation

### 3.1 Manual Testing Checklist

- [ ] Dev server with `npm run dev` shows cross-origin isolated in console
- [ ] Chrome 92+: Multi-threaded WASM loads successfully
- [ ] Firefox 89+: Multi-threaded WASM loads successfully
- [ ] Safari 15.2+: Multi-threaded WASM loads successfully (verify with macOS)
- [ ] Safari 14: Falls back to single-threaded gracefully
- [ ] Mobile Chrome: Test on Android device
- [ ] Mobile Safari: Test on iOS device
- [ ] PostHog analytics still works
- [ ] Google Fonts still load
- [ ] PWA installation still works
- [ ] Service Worker updates correctly

### 3.2 Performance Benchmarks

Create a benchmark comparing single vs threaded for:

1. Simple 1x1x2 bin (expect minimal difference)
2. 4x4x6 bin with 8x8 compartments (expect 2-3x improvement)
3. Complex bin with honeycomb walls + label tabs (expect 2-3x improvement)

### 3.3 Unit Tests

**File:** `src/features/generation/utils/wasmCapabilities.test.ts`

```typescript
describe('wasmCapabilities', () => {
  it('detects SharedArrayBuffer support', () => {
    // Mock crossOriginIsolated
  });

  it('returns cached result on subsequent calls', () => {
    // Verify caching behavior
  });

  it('handles missing navigator gracefully', () => {
    // Worker context test
  });
});
```

---

## Rollout Strategy

### Stage 1: Development (Week 1)

- Build and test threaded WASM locally
- Verify COOP/COEP headers don't break existing functionality
- Add capability detection and dynamic loading

### Stage 2: Staging (Week 2)

- Deploy to Vercel preview environment
- Test on multiple browsers and devices
- Monitor for any third-party script issues

### Stage 3: Production (Week 3)

- Deploy with feature flag (opt-in)
- Monitor error rates and performance metrics
- Gradually enable for all users

---

## Risks & Mitigations

| Risk                               | Mitigation                                             |
| ---------------------------------- | ------------------------------------------------------ |
| COEP breaks third-party scripts    | Use `credentialless` mode; test PostHog/fonts early    |
| Larger WASM size (~15MB)           | Both variants cached by service worker                 |
| Thread pool overhead               | Only significant for complex operations                |
| Service worker conflicts with COOP | Test PWA installation/update flow                      |
| Memory issues on low-end devices   | Fallback to single-threaded on SharedArrayBuffer error |

---

## Files Changed Summary

### brepjs repository

| File                                                                 | Change   |
| -------------------------------------------------------------------- | -------- |
| `packages/brepjs-opencascade/build-source/custom_build_threaded.yml` | New      |
| `packages/brepjs-opencascade/package.json`                           | Modified |
| `.github/workflows/publish-opencascade.yml`                          | Modified |

### gridfinity-layout-tool repository

| File                                                  | Change   |
| ----------------------------------------------------- | -------- |
| `vercel.json`                                         | Modified |
| `vite.config.ts`                                      | Modified |
| `src/features/generation/utils/wasmCapabilities.ts`   | New      |
| `src/features/generation/worker/generation.worker.ts` | Modified |
| `src/features/generation/bridge/types.ts`             | Modified |
| `src/features/generation/bridge/GenerationBridge.ts`  | Modified |

---

## Expected Outcomes

- **Performance:** 2-3x faster bin generation for complex geometries
- **Compatibility:** Graceful fallback maintains current behavior for unsupported browsers
- **Observability:** Analytics track threading adoption rates
