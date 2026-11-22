import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import * as z from 'zod';
import type { AskCorpus } from '../../api/lib/docsAsk/corpus.js';
import { costUsd } from '../../api/lib/docsAsk/spend.js';
import { GROUP_RULES } from './golden';
import type { GoldenCase } from './golden';

export const JUDGE_MODEL = 'claude-opus-5-5';

export const verdictSchema = z.object({
  verdict: z.enum(['pass', 'partial', 'fail']),
  /** True when the source pages answer the question, which voids a gap trap. */
  sourcesAnswer: z.boolean(),
  missing: z.array(z.string()),
  wrong: z.array(z.string()),
  note: z.string(),
});
export type Verdict = z.infer<typeof verdictSchema>;

export interface JudgedTurn {
  readonly question: string;
  readonly answer: string;
  /** drawer_fit results only; page reads repeat the sources. */
  readonly checks: readonly string[];
}

const INSTRUCTIONS = `You grade answers from Ask AI, the docs assistant of the Gridfinity Layout Tool. The source pages are the truth. Grade only against them and the tool results shown, not against what you believe about the app.

- pass: every fact is supported by the sources, and the answer meets the group rule and the expected answer.
- partial: correct but misses a needed fact, or meets the group rule only in part.
- fail: states something that the sources contradict or do not support, misses the point of the question, or breaks the group rule.

The sources are the pages the question was written against, plus every page that the answer opened or linked. Set "sourcesAnswer" to true when the sources answer the question. If the group is "gap" but the sources do answer it, the golden set is wrong: grade the answer on correctness instead of the group rule.

Two things are not errors. The assistant's instructions let it link the Q&A forum, so a forum link needs no source. In another language, a label may stay in English when the app keeps it in English.

List each missing fact in "missing" and each wrong or unsupported claim in "wrong". Keep "note" to one sentence. [[ui:Label]] marks a control name; [[capture:id]] marks a picture.`;

export async function judge(
  client: Anthropic,
  corpus: AskCorpus,
  golden: GoldenCase,
  turns: readonly JudgedTurn[],
  pages: readonly string[],
  model = JUDGE_MODEL
): Promise<{ verdict: Verdict; costUsd: number }> {
  const sources = pages
    .map((link) => corpus.pages[link])
    .filter((page) => page !== undefined)
    .map((page) => `<page url="${page.url}">\n${page.markdown}\n</page>`)
    .join('\n\n');
  const conversation = turns
    .map((turn, i) => {
      const checks =
        turn.checks.length > 0 ? `\n<drawer_fit>\n${turn.checks.join('\n')}\n</drawer_fit>` : '';
      return `<turn n="${i + 1}">\n<question>${turn.question}</question>${checks}\n<answer>\n${turn.answer}\n</answer>\n</turn>`;
    })
    .join('\n');
  const reader = golden.locale ? ` The reader's language is ${golden.locale}.` : '';
  const response = await client.messages.parse({
    model,
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low', format: zodOutputFormat(verdictSchema) },
    system: INSTRUCTIONS,
    messages: [
      {
        role: 'user',
        content: `<sources>\n${sources || '(none: the docs do not cover this question)'}\n</sources>\n\n<group rule="${golden.group}">${GROUP_RULES[golden.group]}${reader}</group>\n<expected>${golden.expect}</expected>\n\n${conversation}\n\nGrade the last answer.`,
      },
    ],
  });
  const verdict = response.parsed_output;
  if (!verdict) throw new Error(`Judge gave no verdict for ${golden.id}`);
  return { verdict, costUsd: costUsd(response.model, response.usage) };
}
