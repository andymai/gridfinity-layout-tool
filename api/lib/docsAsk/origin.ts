const PRODUCTION_ORIGIN = 'https://gridfinitylayouttool.com';

/**
 * The app origin that tool links point to: a preview deployment links to
 * itself, so a link format that is new on its branch can be opened there.
 */
export function appOrigin(env: Readonly<Record<string, string | undefined>> = process.env): string {
  return env.VERCEL_ENV === 'preview' && env.VERCEL_URL
    ? `https://${env.VERCEL_URL}`
    : PRODUCTION_ORIGIN;
}
