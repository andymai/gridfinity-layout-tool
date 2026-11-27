/**
 * Splits text into lines no wider than `maxWidth`. Words break at spaces;
 * a word wider than a line (or a script with no spaces, such as Chinese)
 * breaks between characters.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (text: string) => number
): string[] {
  const lines: string[] = [];
  let line = '';
  const push = (): void => {
    if (line) lines.push(line);
    line = '';
  };
  for (const word of text.split(/(\s+)/)) {
    if (!word) continue;
    const candidate = line + word;
    if (measure(candidate.trimEnd()) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (/^\s+$/.test(word)) {
      push();
      continue;
    }
    push();
    if (measure(word) <= maxWidth) {
      line = word;
      continue;
    }
    for (const char of word) {
      if (measure(line + char) > maxWidth) push();
      line += char;
    }
  }
  push();
  return lines.map((each) => each.trim());
}

/** Keeps at most `max` lines; a cut ends the last kept line with an ellipsis. */
export function clampLines(
  lines: readonly string[],
  max: number,
  maxWidth: number,
  measure: (text: string) => number
): string[] {
  if (lines.length <= max) return [...lines];
  const kept = lines.slice(0, max);
  // Whole characters, so an emoji is never cut in half.
  const chars = Array.from(kept[max - 1] ?? '');
  while (chars.length > 0 && measure(`${chars.join('')}…`) > maxWidth) chars.pop();
  kept[max - 1] = `${chars.join('').trimEnd()}…`;
  return kept;
}
