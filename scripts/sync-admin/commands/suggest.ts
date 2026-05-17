import { analyze } from '../lib/findings.js';
import { buildInventory } from '../lib/inventory.js';
import { colors } from '../lib/output.js';
import { connect } from '../lib/redis.js';
import {
  categoryOf,
  SCRIPT_PREAMBLE,
  SUGGEST_CATEGORIES,
  suggestFor,
  type SuggestCategory,
} from '../lib/suggest.js';
import type { Args } from '../lib/args.js';

// stale-tombstones + malformed live entirely in Redis, no Blob calls needed.
const NEEDS_BLOBS: Record<SuggestCategory, boolean> = {
  drift: true,
  orphans: true,
  'stale-tombstones': false,
  malformed: false,
};

export async function suggest(args: Args): Promise<number> {
  const cat = args.positional[0] as SuggestCategory | undefined;
  if (!cat || !SUGGEST_CATEGORIES.includes(cat)) {
    console.error(`suggest <category> required. One of: ${SUGGEST_CATEGORIES.join(', ')}`);
    return 2;
  }

  const redis = connect();
  try {
    const inv = await buildInventory(redis, {
      user: args.user,
      kind: args.kind,
      skipBlobs: !NEEDS_BLOBS[cat],
    });
    const findings = await analyze(inv, {
      // Payload fetching only contributes envelope/payload findings, none of
      // which feed into `suggest`'s categories. Skip the fetch pass entirely.
      fetchPayloads: false,
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
    for (const line of SCRIPT_PREAMBLE) console.log(line);
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
