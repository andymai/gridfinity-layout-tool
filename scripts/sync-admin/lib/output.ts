import type { Finding } from './types.js';

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  red: (s: string) => (COLOR ? `\x1b[31m${s}\x1b[0m` : s),
  yellow: (s: string) => (COLOR ? `\x1b[33m${s}\x1b[0m` : s),
  cyan: (s: string) => (COLOR ? `\x1b[36m${s}\x1b[0m` : s),
  dim: (s: string) => (COLOR ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s: string) => (COLOR ? `\x1b[1m${s}\x1b[0m` : s),
};

export const colors = c;

export function severityLabel(sev: Finding['severity']): string {
  if (sev === 'error') return c.red('ERROR');
  if (sev === 'warn') return c.yellow('WARN ');
  return c.dim('INFO ');
}

export function formatFinding(f: Finding): string {
  const id = f.id ? `${f.uid.slice(0, 12)}…/${f.itemKind}/${f.id}` : f.uid.slice(0, 12) + '…';
  return `  ${severityLabel(f.severity)}  ${c.bold(f.kind)}  ${id}  — ${f.detail}`;
}

export function formatTable(
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[]
): string {
  const widths = headers.map((h, i) =>
    Math.max(String(h).length, ...rows.map((r) => String(r[i] ?? '').length))
  );
  const fmtRow = (r: readonly (string | number)[]): string =>
    r.map((v, i) => String(v ?? '').padEnd(widths[i])).join('  ');
  const lines = [c.bold(fmtRow(headers))];
  for (const r of rows) lines.push(fmtRow(r));
  return lines.join('\n');
}
