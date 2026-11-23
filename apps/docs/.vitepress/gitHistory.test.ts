import { describe, expect, it } from 'vitest';
import { hasFullGitHistory } from './gitHistory';

describe('hasFullGitHistory', () => {
  it('trusts a clone with its whole history', () => {
    expect(hasFullGitHistory(() => 'false\n')).toBe(true);
  });

  it('does not trust a shallow clone', () => {
    expect(hasFullGitHistory(() => 'true\n')).toBe(false);
  });

  it('does not trust a build without git or a repository', () => {
    expect(
      hasFullGitHistory(() => {
        throw new Error('spawnSync git ENOENT');
      })
    ).toBe(false);
  });
});
