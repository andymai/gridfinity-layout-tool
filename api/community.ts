import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from './lib/method.js';
import { singleParam } from './lib/shared.js';
import { communityRequiresDescription } from './lib/communityValidation.js';
import { communityPrintsEnabled } from './lib/communityPrintValidation.js';
import { handlePublish } from './lib/communityPublish.js';
import { handleList } from './lib/communityList.js';

/**
 * The three server switches the client cannot otherwise observe. Without this
 * the publish dialog only learns publishing is off by POSTing a finished
 * design and reading a 503, which is the worst possible moment to find out.
 *
 * Rides the existing GET rather than taking its own file: each api/ module is
 * a separate deployed function, and this answer is three booleans.
 */
function handleCapabilities(res: VercelResponse): void {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({
    publishEnabled: process.env.COMMUNITY_PUBLISH_ENABLED === 'true',
    printsEnabled: communityPrintsEnabled(),
    requireDescription: communityRequiresDescription(),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  if (req.method === 'GET') {
    if (singleParam(req.query.capabilities) === '1') {
      handleCapabilities(res);
      return;
    }
    await handleList(req, res);
    return;
  }
  await handlePublish(req, res);
}
