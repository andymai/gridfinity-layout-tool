# Tester Agent Memory - Gridfinity Layout Tool

## Test Framework

- **Vitest** with jsdom environment
- **Setup file**: `src/test/setup.ts` — provides i18n mock, matchMedia mock, ResizeObserver mock, cleanup
- **Test utils**: `src/test/testUtils.ts` — `createTestLayout()`, `resetAllStores()`, `setupFakeTimers()`
- **Colocated tests**: `foo.ts` + `foo.test.ts` in same directory (enforced by pre-commit hook)
- **Path alias**: `@/` maps to `src/`

## Mock Patterns

### vi.hoisted + vi.mock (for mocks referenced in factory)

```ts
const mockFn = vi.hoisted(() => vi.fn());
vi.mock('@/some/module', () => ({ exportedFn: mockFn }));
// Use mockFn.mockClear() in beforeEach
```

### vi.mock inline factory (no hoisting needed)

```ts
vi.mock('../../core/storage', () => ({
  saveLayout: vi.fn(),
  loadLayout: vi.fn().mockResolvedValue(null),
}));
```

### Clearing mocks between tests

Use `mockFn.mockClear()` in `beforeEach`, not `mockReset()` (preserves implementation).

## localStorage in Tests

- jsdom provides a working `localStorage` implementation
- `localStorage.clear()` in `beforeEach`/`afterEach` for isolation
- Override `localStorage.key` or `localStorage.removeItem` with `Object.defineProperty` (configurable: true) to test error branches
- Always restore the original after the test

## IndexedDB in Tests

- `fake-indexeddb/auto` is auto-imported by setup.ts — tests can use real IDB calls
- `closeDatabase()` in `beforeEach`/`afterEach` for isolation (see `indexedDB.test.ts`)

## Import Paths in vi.mock

- Use relative paths (`'./backends/indexedDB'`) when mocking relative imports
- Use `@/` alias paths when mocking absolute imports (`'@/shared/analytics/posthog'`)
- Match exactly what the source file uses

## Settings Store in Tests

- `useSettingsStore.getState().resetSettings()` in `beforeEach` to clear persisted state (e.g. `dismissedHints`) between tests
- Spy on individual actions: `vi.spyOn(useSettingsStore.getState(), 'updateSetting')`

## Async Migration Testing

- For migrations that catch errors and skip setting the done flag: assert flag absence with `expect(localStorage.getItem(key)).toBeNull()`
- Use `vi.mocked(fn).mockRejectedValueOnce(new Error(...))` to simulate IDB write failure
- `vi.clearAllMocks()` in `beforeEach` resets call counts but keeps mock implementations

## Running Tests

```bash
npx vitest run src/path/to/file.test.ts   # single file
npm run test:coverage                      # all tests with coverage
```
