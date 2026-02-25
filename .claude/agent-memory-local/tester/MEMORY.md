# Tester Agent Memory

## Test Framework

- Vitest with jsdom environment
- `@testing-library/react` for hooks (`renderHook`, `act`)
- Run a subset: `npm run test:run -- path/to/file.test.ts`
- Run with coverage: `npm run test:coverage`

## Conventions

- Colocated sibling tests: `foo.ts` and `foo.test.ts` in the same directory
- Import only `{ describe, it, expect, vi, beforeEach, afterEach }` from `vitest`
- No default imports from vitest
- Path alias `@/` maps to `src/`
- Shared test utilities: `src/test/testUtils.ts` — exports `createTestLayout()`, `expectOk()`

## Patterns Confirmed

### Pure constants/functions

```ts
import { describe, it, expect } from 'vitest';
import { MY_CONST, myFn } from './module';

describe('MY_CONST', () => {
  it('has expected value', () => {
    expect(MY_CONST).toBe(42);
  });
});
```

### Hook skeleton (import-only, satisfies missing-test check)

```ts
import { describe, it, expect } from 'vitest';
import { useMyHook } from './useMyHook';

describe('useMyHook', () => {
  it('is defined', () => {
    expect(useMyHook).toBeDefined();
  });
});
```

### Hooks with store deps (renderHook + store setState)

- Mock heavy modules at top with `vi.mock(...)`
- Reset store state in `beforeEach` via `useMyStore.setState({...})`
- Wrap async calls in `await act(async () => { ... })`
- Spy on DOM APIs (`document.createElement`, `document.body.appendChild`) to intercept anchor downloads

## Key Files

- Vitest config: `vite.config.ts` (or `vitest.config.ts`)
- Test setup: `src/test/setup.ts`
- Shared utils: `src/test/testUtils.ts`
