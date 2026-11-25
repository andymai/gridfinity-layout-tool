import { describe, expect, it } from 'vitest';
import { appOrigin } from './origin.js';

describe('appOrigin', () => {
  it('links a preview deployment to itself and everything else to production', () => {
    expect(appOrigin({ VERCEL_ENV: 'preview', VERCEL_URL: 'gflt-git-x.vercel.app' })).toBe(
      'https://gflt-git-x.vercel.app'
    );
    expect(appOrigin({ VERCEL_ENV: 'production', VERCEL_URL: 'gflt-abc.vercel.app' })).toBe(
      'https://gridfinitylayouttool.com'
    );
    expect(appOrigin({})).toBe('https://gridfinitylayouttool.com');
  });
});
