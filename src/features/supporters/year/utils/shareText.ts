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
