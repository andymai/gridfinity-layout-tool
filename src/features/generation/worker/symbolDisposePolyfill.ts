/**
 * Polyfill for Symbol.dispose / Symbol.asyncDispose.
 *
 * brepjs 8.x uses TC39 Explicit Resource Management (`using` keyword).
 * esbuild compiles this with a `__using` helper that falls back to
 * `Symbol.for("Symbol.dispose")` when the native well-known symbol is absent.
 * However, class definitions in *other* chunks use raw `Symbol.dispose` directly,
 * which is `undefined` in unsupported browsers (Safari, older Firefox/Chrome).
 * This causes "Object not disposable" errors at runtime.
 *
 * This polyfill bridges the gap by assigning the same fallback symbol that
 * esbuild's `__knownSymbol` helper uses, so both paths agree.
 *
 * MUST be imported before any brepjs code (including transitive imports).
 */

const S = Symbol as unknown as Record<string, symbol | undefined>;
S.dispose ??= Symbol.for('Symbol.dispose');
S.asyncDispose ??= Symbol.for('Symbol.asyncDispose');
