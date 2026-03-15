Bug: $ARGUMENTS

Follow this structured workflow to fix the bug described above. Do NOT skip steps.

## 1. Understand

- Identify the expected vs actual behavior from the bug description.
- Determine the affected feature area (bin-designer, generation, grid-editor, etc.).
- Read the relevant feature README if one exists: `src/features/<area>/README.md`.

## 2. Reproduce

- Find or create a **failing test** that demonstrates the bug with real dependencies.
- **Never mock runtime libraries** (brepjs, Three.js) — if setup fails, fix the setup.
- If no test file exists for the affected code, create one as a colocated sibling (`foo.test.ts`).

## 3. Trace the Data Path

Investigate every layer the bug could touch. Don't stop at the first layer that looks wrong.

| Layer             | What to check                                                                         |
| ----------------- | ------------------------------------------------------------------------------------- |
| **Store**         | Action logic, state shape, `Result` handling, undo integration                        |
| **Hook/Selector** | Stale closures, missing deps, `useShallow` for multi-select                           |
| **Component**     | Prop passing, coordinate transforms (grid origin = bottom-left), error states         |
| **Computation**   | Units (mm vs grid vs height), coordinate system (Y-up), edge cases (0, NaN, Infinity) |

## 4. Fix All Affected Layers

- Apply fixes at every layer where issues were found.
- Each fix must have a corresponding test assertion.
- For geometry/generation changes, run scenario tests:
  ```bash
  pnpm run test:run -- src/features/generation/worker/generators/binGenerator.scenario
  ```

## 5. Validate

```bash
pnpm run test:coverage   # All tests pass with coverage
pnpm run build           # TypeScript compiles cleanly
```

## 6. Sanity Checklist

Before declaring the bug fixed, verify:

- [ ] No mocks/stubs introduced for runtime libraries in production code
- [ ] Every fix has a test assertion proving it works
- [ ] No `console.log`, `any`, or non-null assertions (`!`) introduced
- [ ] Related tests in the same feature area still pass
- [ ] If geometry changed: scenario tests pass, output > 0, no NaN/Infinity
