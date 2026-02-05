Investigate: $ARGUMENTS

Perform a multi-layer investigation of the issue described above. Analyze all layers in parallel to find the root cause.

## Investigation Scope

Investigate these four layers. For each, report: **OK**, **Suspicious**, or **Bug** with evidence and file:line references.

### Store Layer

- Read the relevant store action(s) in `src/core/store/`
- Check state shape mutations, `Result` handling, error propagation
- Verify undo integration (`useUndoableAction`) if state is modified
- Check for race conditions in async operations

### Hook/Selector Layer

- Read hooks in `src/features/<area>/hooks/` and `src/hooks/`
- Check for stale closures (missing useEffect/useCallback deps)
- Verify `useShallow` is used for multi-value Zustand selectors
- Check derived state calculations and memoization

### Component Layer

- Read the affected component(s)
- Check prop passing and event handler wiring
- Verify coordinate transforms (grid origin = bottom-left, UI reverses via `getDisplayLayers()`)
- Check conditional rendering and error/loading states

### Computation Layer

- Read generators, builders, or utility functions involved
- Check unit conversions: grid units (42mm), height units (7mm), mm
- Verify coordinate system: Y-up for 3D, origin bottom-left for grid
- Check edge cases: zero dimensions, fractional (half-bin), boundary values
- Verify: output > 0, no NaN/Infinity

## Output Format

```
## Layer Analysis

### Store: [OK | Suspicious | Bug]
Evidence: ...
Files: ...

### Hook/Selector: [OK | Suspicious | Bug]
Evidence: ...
Files: ...

### Component: [OK | Suspicious | Bug]
Evidence: ...
Files: ...

### Computation: [OK | Suspicious | Bug]
Evidence: ...
Files: ...

## Root Cause Synthesis
[Which layer(s) contain the actual bug, how they interact, and recommended fix approach]
```
