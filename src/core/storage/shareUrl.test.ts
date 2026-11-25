// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { getPlanLinkFromURL, getSharedLayoutFromURL } from './shareUrl';

describe('getPlanLinkFromURL', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('reads the encoded plan and leaves a #share= link alone', () => {
    window.location.hash = '#plan=v1.abc';
    expect(getPlanLinkFromURL()).toBe('v1.abc');
    expect(getSharedLayoutFromURL()).toBeNull();
    window.location.hash = '#share=abc';
    expect(getPlanLinkFromURL()).toBeNull();
  });
});
