/**
 * Unwrap helpers for brepjs export Results (STL and STEP).
 *
 * brepjs returns `Result<Blob, BrepError>` from its export functions. Using
 * brepjs's `unwrap()` rethrows with `"Called unwrap on an Err: [IO] STL_EXPORT_FAILED: ..."`,
 * which leaks Rust-style panic phrasing into the user-facing toast. This
 * helper unpacks the structured error and throws an `Error` whose message is
 * a plain sentence the user can act on.
 */

import { isOk, type Result } from 'brepjs';

interface BrepLikeError {
  readonly kind?: string;
  readonly code?: string;
  readonly message?: string;
  readonly suggestion?: string;
}

type ExportFormat = 'STL' | 'STEP';

const DEFAULT_SUGGESTION: Record<ExportFormat, string> = {
  STL: 'Try disabling features one at a time (scoop, cutouts, handles, wall pattern) to find the failing combination, then report the issue.',
  STEP: 'Try a simpler bin configuration — STEP requires valid BREP geometry, which complex feature combinations can violate.',
};

/**
 * Extract a Blob from an export Result, throwing a user-readable Error on failure.
 *
 * The thrown error preserves the structured `BrepError` via `cause` so
 * telemetry retains the full code/kind/metadata, while the surfaced
 * message stays short and actionable.
 */
export function unwrapExportBlob(result: Result<Blob>, format: ExportFormat): Blob {
  if (isOk(result)) return result.value;
  const error = result.error as BrepLikeError;
  const code = error.code ?? 'UNKNOWN';
  const detail = error.message ?? `${format} export failed`;
  // `||` (not `??`): brepjs may serialize a missing suggestion as `""`, and
  // an empty string here would silently drop the default actionable hint.
  const suggestion = error.suggestion || DEFAULT_SUGGESTION[format];
  throw Object.assign(new Error(`${detail} (${code}) — ${suggestion}`, { cause: error }), {
    name: 'ExportFailed',
  });
}
