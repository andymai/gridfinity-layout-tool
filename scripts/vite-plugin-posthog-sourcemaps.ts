/**
 * Uploads the production build's hidden source maps to PostHog error tracking,
 * through PostHog's Rollup plugin, which injects chunk ids before the chunk
 * hashes are computed.
 *
 * It uploads only when POSTHOG_API_KEY and POSTHOG_PROJECT_ID are set, and on
 * Vercel only for the production deploy: a preview would publish symbol sets
 * for bundles that are then discarded. Without those, the plugin does nothing.
 */
import posthog from '@posthog/rollup-plugin';
import { loadEnv, type Plugin, type PluginOption } from 'vite';

type Handler = (this: unknown, ...args: unknown[]) => unknown;
type Hook = Handler | { handler: Handler };

export interface UploadEnv {
  readonly POSTHOG_API_KEY?: string;
  readonly POSTHOG_PROJECT_ID?: string;
  readonly VERCEL?: string;
  readonly VERCEL_ENV?: string;
}

export function skipReason(env: UploadEnv): string | null {
  if (!env.POSTHOG_API_KEY) return 'POSTHOG_API_KEY is not set';
  if (!env.POSTHOG_PROJECT_ID) return 'POSTHOG_PROJECT_ID is not set';
  if (env.VERCEL && env.VERCEL_ENV !== 'production')
    return `this is a ${env.VERCEL_ENV ?? 'non-production'} deploy`;
  return null;
}

let skipLogged = false;

/**
 * Error tracking is not a release gate: when injection or upload fails, the
 * build goes on without symbolication.
 */
export function nonFatal<P extends object>(plugin: P, warn: (message: string) => void): P {
  let failed = false;
  const hooks = plugin as Record<string, Hook | undefined>;
  for (const name of ['renderChunk', 'writeBundle']) {
    const hook = hooks[name];
    if (!hook) continue;
    const handler = typeof hook === 'function' ? hook : hook.handler;
    const guarded: Handler = async function (this: unknown, ...args: unknown[]) {
      if (failed) return null;
      try {
        return await handler.apply(this, args);
      } catch (error) {
        failed = true;
        warn(
          `PostHog source maps: ${error instanceof Error ? error.message : String(error)}. The build goes on without symbolication.`
        );
        return null;
      }
    };
    hooks[name] = typeof hook === 'function' ? guarded : { ...hook, handler: guarded };
  }
  return plugin;
}

export function posthogSourcemaps(root: string = process.cwd()): PluginOption {
  // The keys matter only to a production build, and `.env.local` holds them locally.
  const keys = loadEnv('production', root, 'POSTHOG_');
  const reason = skipReason({
    ...keys,
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
  // Without an upload the PostHog plugin is not built at all: no chunk ids,
  // no CLI lookup.
  if (reason) {
    const skipped: Plugin = {
      name: 'posthog-sourcemaps-skipped',
      apply: 'build',
      buildStart() {
        if (skipLogged) return;
        skipLogged = true;
        this.info(`Skipping source map upload: ${reason}.`);
      },
    };
    return skipped;
  }
  const plugin = posthog({
    personalApiKey: keys.POSTHOG_API_KEY ?? '',
    projectId: keys.POSTHOG_PROJECT_ID ?? '',
    host: keys.POSTHOG_HOST,
    sourcemaps: {
      enabled: true,
      releaseName: process.env.VERCEL_GIT_REPO_SLUG ?? 'gridfinity-layout-tool',
      releaseVersion: process.env.VERCEL_GIT_COMMIT_SHA,
      deleteAfterUpload: true,
    },
  });
  return nonFatal(plugin, (message) => console.warn(message)) as PluginOption;
}
