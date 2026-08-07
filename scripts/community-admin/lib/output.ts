const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  red: (s: string) => (COLOR ? `\x1b[31m${s}\x1b[0m` : s),
  yellow: (s: string) => (COLOR ? `\x1b[33m${s}\x1b[0m` : s),
  cyan: (s: string) => (COLOR ? `\x1b[36m${s}\x1b[0m` : s),
  dim: (s: string) => (COLOR ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s: string) => (COLOR ? `\x1b[1m${s}\x1b[0m` : s),
};

export const colors = c;

/**
 * Neutralize attacker-authored text before it reaches the operator's terminal.
 *
 * A design's `name` and `authorName` are user-supplied and validated only for
 * length plus the content blocklist, neither of which removes C0/C1 control
 * bytes. Printed raw, an ESC sequence can clear the screen, rewrite the rows
 * above it so a malicious design's id or status reads as a different one, erase
 * the DIRECT WRITE warning banner, or (on OSC 52 terminals) set the clipboard —
 * all in the output a moderator is reading to decide what to hide or purge.
 *
 * Replaces rather than strips, so the operator can SEE that the field was
 * tampered with instead of reading a plausible shortened name. `--json` output
 * is already safe: JSON.stringify escapes control bytes.
 */
export function sanitizeForTerminal(value: string): string {
  // eslint-disable-next-line no-control-regex -- the point is to match control bytes
  return value.replace(/[\x00-\x1F\x7F-\x9F]/g, '�');
}

export function formatTable(
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[]
): string {
  // Width is measured on the sanitized value, or a control byte would consume
  // a column slot without occupying a cell and skew every row after it.
  const clean = (v: string | number | undefined): string => sanitizeForTerminal(String(v ?? ''));
  const widths = headers.map((h, i) =>
    Math.max(clean(h).length, ...rows.map((r) => clean(r[i]).length))
  );
  const fmtRow = (r: readonly (string | number)[]): string =>
    r.map((v, i) => clean(v).padEnd(widths[i])).join('  ');
  const lines = [c.bold(fmtRow(headers))];
  for (const r of rows) lines.push(fmtRow(r));
  return lines.join('\n');
}
