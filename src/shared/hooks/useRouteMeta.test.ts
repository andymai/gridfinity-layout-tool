import { describe, expect, it } from 'vitest';
import { routeTitleKey } from './useRouteMeta';

const NONE = {
  isDesignerRoute: false,
  isBaseplateRoute: false,
  isSupportersRoute: false,
  isYour2026Route: false,
  isCommunityRoute: false,
  isLabelsRoute: false,
};

describe('routeTitleKey', () => {
  it('names each page route', () => {
    expect(routeTitleKey({ ...NONE, isDesignerRoute: true })).toBe('seo.designer.title');
    expect(routeTitleKey({ ...NONE, isLabelsRoute: true })).toBe('seo.labels.title');
    expect(routeTitleKey({ ...NONE, isCommunityRoute: true })).toBe('seo.community.title');
    expect(routeTitleKey({ ...NONE, isYour2026Route: true })).toBe('seo.your2026.title');
  });

  it('has no page title in the layout editor', () => {
    expect(routeTitleKey(NONE)).toBeNull();
  });
});
