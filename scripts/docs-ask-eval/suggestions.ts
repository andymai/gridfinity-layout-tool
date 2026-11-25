import { pageLink, readDocPages } from '../check-user-docs';
import type { DocPage } from '../check-user-docs';
import type { GoldenCase } from './golden';

const EXPECT =
  'A direct answer from the docs that covers every part of the question, with correct facts, steps and links. A starter question must be one that the docs answer, so an answer that says they do not cover it fails.';

/** Each docs page's starter questions, asked on that page as a reader who clicks one. */
export function suggestionCases(pages: readonly DocPage[] = readDocPages()): GoldenCase[] {
  return pages.flatMap((page) => {
    const value: unknown = page.data.questions;
    const questions = Array.isArray(value)
      ? value.filter((q): q is string => typeof q === 'string')
      : [];
    const link = pageLink(page.file);
    return questions.map((question, i) => ({
      id: `${link}#${i + 1}`,
      group: 'synthesis' as const,
      page: link,
      turns: [question],
      sources: [],
      expect: EXPECT,
    }));
  });
}
