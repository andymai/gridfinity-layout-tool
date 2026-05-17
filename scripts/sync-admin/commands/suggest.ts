import { analyze } from '../lib/findings.js';
import { buildInventory } from '../lib/inventory.js';
import { colors } from '../lib/output.js';
import { connect } from '../lib/redis.js';
import {
  categoryOf,
  SUGGEST_CATEGORIES,
  suggestFor,
  type SuggestCategory,
} from '../lib/suggest.js';
import type { Args } from '../lib/args.js';

export async function suggest(args: Args): Promise<number> {
  const cat = args.positional[0] as SuggestCategory | undefined;
  if (!cat || !SUGGEST_CATEGORIES.includes(cat)) {
    console.error(`suggest <category> required. One of: ${SUGGEST_CATEGORIES.join(', ')}`);
    return 2;
  }

  const redis = connect();
  try {
    const inv = await buildInventory(redis, { user: args.user, kind: args.kind });
    const findings = await analyze(inv, {
      fetchPayloads: !args.noPayloadFetch,
      staleTombstoneMs: args.olderThanMs,
    });
    const matched = findings.filter((f) => categoryOf(f) === cat);

    if (args.json) {
      process.stdout.write(
        JSON.stringify(
          matched.map((f) => ({ ...f, suggestions: suggestFor(f) })),
          null,
          2
        ) + '\n'
      );
      return 0;
    }

    if (matched.length === 0) {
      console.log(colors.cyan(`✓ no findings in category "${cat}"`));
      return 0;
    }
    console.log(`# sync-admin suggest ${cat} — ${matched.length} finding(s)`);
    console.log(`# Review each command before running.`);
    console.log('');
    for (const f of matched) {
      for (const line of suggestFor(f)) console.log(line);
      console.log('');
    }
    return 0;
  } finally {
    await redis.quit();
  }
}
