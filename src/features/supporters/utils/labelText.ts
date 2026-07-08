/**
 * Word-wrap a supporter name into at most `maxLines` lines of roughly
 * `maxCharsPerLine`, truncating with an ellipsis if it still overflows.
 * Pure string logic (no canvas) so it is unit-tested directly; the canvas
 * label texture builds on top of it.
 */
export function fitLabelLines(name: string, maxCharsPerLine = 9, maxLines = 2): string[] {
  const trimmed = name.trim();
  if (!trimmed) return [];

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current) {
      lines.push(current);
      current = '';
    }
  };

  for (const word of words) {
    // Hard-break a single word longer than a line.
    if (word.length > maxCharsPerLine) {
      pushCurrent();
      let rest = word;
      while (rest.length > maxCharsPerLine) {
        lines.push(rest.slice(0, maxCharsPerLine));
        rest = rest.slice(maxCharsPerLine);
      }
      current = rest;
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine) {
      pushCurrent();
      current = word;
    } else {
      current = candidate;
    }
  }
  pushCurrent();

  if (lines.length <= maxLines) return lines;

  const capped = lines.slice(0, maxLines);
  const last = capped[maxLines - 1];
  capped[maxLines - 1] = `${last.slice(0, Math.max(0, maxCharsPerLine - 1))}…`;
  return capped;
}
