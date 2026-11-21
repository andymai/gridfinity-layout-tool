export interface SearchSection {
  readonly link: string;
  readonly page: string;
  readonly heading: string;
  readonly anchor: string;
  readonly text: string;
}

export interface SearchHit {
  readonly link: string;
  readonly page: string;
  readonly heading: string;
  readonly anchor: string;
  readonly snippet: string;
}

const STOPWORDS = new Set(
  'a an and are as at be by can do does for from how i in is it my of on or the this to what when where which why with you your'.split(
    ' '
  )
);
const K1 = 1.2;
const B = 0.75;
// A word in a heading or a page title says more about a section than one in its text.
const HEADING_WEIGHT = 3;
const PAGE_WEIGHT = 2;
const SNIPPET_CHARS = 240;

export function tokenize(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map((word) =>
      word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word
    );
}

interface IndexedSection {
  readonly section: SearchSection;
  readonly counts: ReadonlyMap<string, number>;
  readonly length: number;
}

function weightedCounts(section: SearchSection): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (text: string, weight: number): void => {
    for (const word of tokenize(text)) counts.set(word, (counts.get(word) ?? 0) + weight);
  };
  add(section.text, 1);
  add(section.heading, HEADING_WEIGHT);
  add(section.page, PAGE_WEIGHT);
  return counts;
}

function snippet(text: string, words: readonly string[]): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const lower = flat.toLowerCase();
  const hits = words.map((word) => lower.indexOf(word)).filter((at) => at >= 0);
  const first = hits.length > 0 ? Math.min(...hits) : 0;
  let start = Math.max(0, first - SNIPPET_CHARS / 3);
  if (start > 0) start = flat.indexOf(' ', start) + 1;
  let end = Math.min(flat.length, start + SNIPPET_CHARS);
  if (end < flat.length) end = Math.max(flat.lastIndexOf(' ', end), start + 1);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
}

export function createSearch(
  sections: readonly SearchSection[]
): (query: string, limit?: number) => SearchHit[] {
  const indexed: IndexedSection[] = sections.map((section) => {
    const counts = weightedCounts(section);
    let length = 0;
    for (const count of counts.values()) length += count;
    return { section, counts, length };
  });
  const averageLength = indexed.reduce((sum, s) => sum + s.length, 0) / Math.max(1, indexed.length);
  const documentFrequency = new Map<string, number>();
  for (const { counts } of indexed) {
    for (const word of counts.keys())
      documentFrequency.set(word, (documentFrequency.get(word) ?? 0) + 1);
  }
  const total = indexed.length;

  return (query, limit = 6) => {
    const words = [...new Set(tokenize(query))];
    if (words.length === 0) return [];
    const scored: { score: number; at: number; section: SearchSection }[] = [];
    indexed.forEach(({ section, counts, length }, at) => {
      let score = 0;
      for (const word of words) {
        const count = counts.get(word);
        if (!count) continue;
        const df = documentFrequency.get(word) ?? 0;
        const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5));
        score += (idf * count * (K1 + 1)) / (count + K1 * (1 - B + (B * length) / averageLength));
      }
      if (score > 0) scored.push({ score, at, section });
    });
    scored.sort((a, b) => b.score - a.score || a.at - b.at);
    return scored.slice(0, limit).map(({ section }) => ({
      link: section.link,
      page: section.page,
      heading: section.heading,
      anchor: section.anchor,
      snippet: snippet(section.text, words),
    }));
  };
}

const HEADING = /^(#{1,3})\s+(.*?)\s+\{#([^}]+)\}$/;

export function plainText(markdown: string): string {
  return markdown
    .replace(/\[\[ui:([^\]]+)\]\]/g, '$1')
    .replace(/\[\[capture:[^\]]+\]\]\s*/g, '')
    .trim();
}

export function pageSections(link: string, title: string, markdown: string): SearchSection[] {
  const sections: SearchSection[] = [];
  let heading = '';
  let anchor = '';
  let lines: string[] = [];
  const flush = (): void => {
    const text = plainText(lines.join('\n'));
    if (text) sections.push({ link, page: title, heading, anchor, text });
  };
  for (const line of markdown.split('\n')) {
    const match = HEADING.exec(line);
    if (!match) {
      lines.push(line);
      continue;
    }
    flush();
    // The H1 starts the lead section, which links to the page itself.
    heading = match[1] === '#' ? '' : plainText(match[2]);
    anchor = match[1] === '#' ? '' : match[3];
    lines = [];
  }
  flush();
  return sections;
}
