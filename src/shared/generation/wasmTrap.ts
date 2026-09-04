/**
 * A WebAssembly trap ("table index is out of bounds", "memory access out of
 * bounds", "unreachable") aborts the kernel mid-operation with no unwinding.
 * Whatever the kernel was holding on its stack and heap is left half-written,
 * so every later call into the same instance runs on corrupted state: it can
 * trap again, or worse, return geometry that looks valid and is not. The only
 * recovery is a fresh instance, which is why callers must not retry in-process.
 */

const TRAP_MESSAGE_RE =
  /table index is out of bounds|memory access out of bounds|out of bounds memory access|index out of bounds|null function or function signature mismatch|indirect call (?:to null|signature mismatch)|call_indirect to|unreachable(?: executed| code should not be executed)?$/i;

function isRuntimeError(e: unknown): boolean {
  return typeof WebAssembly !== 'undefined' && e instanceof WebAssembly.RuntimeError;
}

export function isWasmTrap(e: unknown): boolean {
  for (let cur: unknown = e, depth = 0; cur !== undefined && cur !== null && depth < 8; depth++) {
    if (isRuntimeError(cur)) return true;
    if (typeof cur === 'string') return TRAP_MESSAGE_RE.test(cur);
    if (!(cur instanceof Error)) return false;
    if (TRAP_MESSAGE_RE.test(cur.message)) return true;
    cur = cur.cause;
  }
  return false;
}
