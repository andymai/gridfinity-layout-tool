import { isValidShareId } from '../../../api/lib/shared.js';
import {
  COMMUNITY_FEATURE_REASONS,
  isCommunityFeatureReason,
} from '../../../api/lib/communityValidation.js';
import { communityDesignKey } from '../../../api/lib/redisKeys.js';
import {
  readCommunityDesignBlob,
  writeCommunityDesignBlob,
} from '../../../api/lib/communityStore.js';
import type { Args } from '../lib/args.js';
import { colors } from '../lib/output.js';
import { connect } from '../lib/redis.js';

/**
 * The featured flag is duplicated on the blob (source of truth for the
 * detail view) and the Redis card hash (source of truth for gallery
 * sorting/filtering), so both writers must agree. Shared by `feature` and
 * `unfeature`.
 */
async function setFeatured(args: Args, featured: boolean): Promise<number> {
  const id = args.positional[0];
  if (!id) {
    console.error(`${featured ? 'feature' : 'unfeature'} <id> is required`);
    return 2;
  }
  if (!isValidShareId(id)) {
    console.error(`not a valid community design id: ${id}`);
    return 2;
  }

  // Featuring requires stating why. An unexplained star is the least legible
  // signal in the feature, and the reason is what the gallery shows.
  let reason = '';
  if (featured) {
    const supplied = args.reason;
    if (supplied === null || !isCommunityFeatureReason(supplied)) {
      console.error(`feature <id> --reason <${COMMUNITY_FEATURE_REASONS.join('|')}> is required`);
      return 2;
    }
    reason = supplied;
  }

  const redis = connect();
  try {
    const record = await readCommunityDesignBlob(id);
    if (!record) {
      console.error(`community design not found: ${id}`);
      return 1;
    }
    // A15: featuring is a moderation flag, not a content edit, so updatedAt is
    // left untouched on both the blob and the card hash. Bumping it would
    // reorder the design in any updatedAt-derived view and misreport it as
    // freshly edited.
    await Promise.all([
      writeCommunityDesignBlob(
        { ...record, featured, featureReason: reason },
        { allowOverwrite: true }
      ),
      redis.hset(communityDesignKey(id), {
        featured: featured ? '1' : '0',
        // Cleared on unfeature so a later re-feature cannot silently inherit
        // a stale reason from a previous decision.
        featureReason: reason,
      }),
    ]);
    console.log(colors.cyan(`${featured ? `featured (${reason})` : 'unfeatured'}: ${id}`));
    return 0;
  } finally {
    await redis.quit();
  }
}

export async function feature(args: Args): Promise<number> {
  return setFeatured(args, true);
}

export async function unfeature(args: Args): Promise<number> {
  return setFeatured(args, false);
}
