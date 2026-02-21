import { describe, it, expect } from 'vitest';
import {
  FEATURE_FLAGS,
  getFeature,
  getActiveFeatures,
  getGraduatedFeatures,
  getToggleableFeatures,
  type FeatureId,
} from './features';

describe('FEATURE_FLAGS', () => {
  it('has at least one feature defined', () => {
    expect(FEATURE_FLAGS.length).toBeGreaterThan(0);
  });

  it('each feature has required properties', () => {
    FEATURE_FLAGS.forEach((feature) => {
      expect(feature).toHaveProperty('id');
      expect(feature).toHaveProperty('name');
      expect(feature).toHaveProperty('description');
      expect(feature).toHaveProperty('status');
      expect(feature).toHaveProperty('risk');
      expect(feature).toHaveProperty('addedAt');
      expect(feature).toHaveProperty('requiresRefresh');
    });
  });

  it('each feature has a non-empty id', () => {
    FEATURE_FLAGS.forEach((feature) => {
      expect(feature.id).toBeTruthy();
      expect(typeof feature.id).toBe('string');
    });
  });

  it('each feature has a non-empty name', () => {
    FEATURE_FLAGS.forEach((feature) => {
      expect(feature.name).toBeTruthy();
      expect(typeof feature.name).toBe('string');
    });
  });

  it('each feature has a non-empty description', () => {
    FEATURE_FLAGS.forEach((feature) => {
      expect(feature.description).toBeTruthy();
      expect(typeof feature.description).toBe('string');
    });
  });

  it('each feature has a valid status', () => {
    const validStatuses = ['experimental', 'preview', 'graduated', 'deprecated'];
    FEATURE_FLAGS.forEach((feature) => {
      expect(validStatuses).toContain(feature.status);
    });
  });

  it('each feature has a valid risk level', () => {
    const validRiskLevels = ['low', 'medium', 'high'];
    FEATURE_FLAGS.forEach((feature) => {
      expect(validRiskLevels).toContain(feature.risk);
    });
  });

  it('each feature has a valid addedAt date format', () => {
    FEATURE_FLAGS.forEach((feature) => {
      expect(feature.addedAt).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  it('requiresRefresh is a boolean', () => {
    FEATURE_FLAGS.forEach((feature) => {
      expect(typeof feature.requiresRefresh).toBe('boolean');
    });
  });

  it('graduated features have graduatedAt defined', () => {
    FEATURE_FLAGS.forEach((feature) => {
      if (feature.status === 'graduated') {
        expect(feature.graduatedAt).toBeDefined();
        expect(feature.graduatedAt).toMatch(/^\d{4}-\d{2}$/);
      }
    });
  });

  it('all feature IDs are unique', () => {
    const ids = FEATURE_FLAGS.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('warning is present for experimental features with medium/high risk', () => {
    FEATURE_FLAGS.forEach((feature) => {
      if (
        feature.status === 'experimental' &&
        (feature.risk === 'medium' || feature.risk === 'high')
      ) {
        expect(feature.warning).toBeDefined();
      }
    });
  });

  it('comingSoon is boolean if present', () => {
    FEATURE_FLAGS.forEach((feature) => {
      if (feature.comingSoon !== undefined) {
        expect(typeof feature.comingSoon).toBe('boolean');
      }
    });
  });

  it('dependencies is an array of strings if present', () => {
    FEATURE_FLAGS.forEach((feature) => {
      if (feature.dependencies !== undefined) {
        expect(Array.isArray(feature.dependencies)).toBe(true);
        feature.dependencies.forEach((dep) => {
          expect(typeof dep).toBe('string');
        });
      }
    });
  });

  it('defaultEnabled is boolean if present', () => {
    FEATURE_FLAGS.forEach((feature) => {
      if (feature.defaultEnabled !== undefined) {
        expect(typeof feature.defaultEnabled).toBe('boolean');
      }
    });
  });
});

describe('getFeature()', () => {
  it('returns feature for valid id', () => {
    const feature = getFeature('bin_designer');
    expect(feature).toBeDefined();
    expect(feature?.id).toBe('bin_designer');
  });

  it('returns undefined for unknown id', () => {
    const feature = getFeature('non_existent_feature');
    expect(feature).toBeUndefined();
  });

  it('returns undefined for empty string id', () => {
    const feature = getFeature('');
    expect(feature).toBeUndefined();
  });

  it('is case-sensitive', () => {
    const feature = getFeature('BIN_DESIGNER');
    expect(feature).toBeUndefined();
  });

  it('returns correct feature for each defined feature', () => {
    FEATURE_FLAGS.forEach((originalFeature) => {
      const retrieved = getFeature(originalFeature.id);
      expect(retrieved).toEqual(originalFeature);
    });
  });

  it('returns the exact object reference from FEATURE_FLAGS', () => {
    const retrieved = getFeature('bin_designer');
    const direct = FEATURE_FLAGS.find((f) => f.id === 'bin_designer');
    expect(retrieved).toBe(direct);
  });
});

describe('getActiveFeatures()', () => {
  it('returns array of features', () => {
    const active = getActiveFeatures();
    expect(Array.isArray(active)).toBe(true);
  });

  it('excludes deprecated features', () => {
    const active = getActiveFeatures();
    const hasDeprecated = active.some((f) => f.status === 'deprecated');
    expect(hasDeprecated).toBe(false);
  });

  it('includes experimental features', () => {
    const active = getActiveFeatures();
    const hasExperimental = active.some((f) => f.status === 'experimental');
    expect(hasExperimental).toBe(true);
  });

  it('includes preview features', () => {
    const active = getActiveFeatures();
    const hasPreview = active.some((f) => f.status === 'preview');
    if (FEATURE_FLAGS.some((f) => f.status === 'preview')) {
      expect(hasPreview).toBe(true);
    }
  });

  it('includes graduated features', () => {
    const active = getActiveFeatures();
    const hasGraduated = active.some((f) => f.status === 'graduated');
    expect(hasGraduated).toBe(true);
  });

  it('returns features from FEATURE_FLAGS only', () => {
    const active = getActiveFeatures();
    active.forEach((feature) => {
      expect(FEATURE_FLAGS).toContain(feature);
    });
  });

  it('has no duplicates', () => {
    const active = getActiveFeatures();
    const ids = active.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('returns all non-deprecated features', () => {
    const active = getActiveFeatures();
    const expectedCount = FEATURE_FLAGS.filter((f) => f.status !== 'deprecated').length;
    expect(active.length).toBe(expectedCount);
  });
});

describe('getGraduatedFeatures()', () => {
  it('returns array of features', () => {
    const graduated = getGraduatedFeatures();
    expect(Array.isArray(graduated)).toBe(true);
  });

  it('returns only graduated features', () => {
    const graduated = getGraduatedFeatures();
    graduated.forEach((feature) => {
      expect(feature.status).toBe('graduated');
    });
  });

  it('includes bin_designer if it is graduated', () => {
    const graduated = getGraduatedFeatures();
    const hasBinDesigner = graduated.some((f) => f.id === 'bin_designer');
    if (FEATURE_FLAGS.find((f) => f.id === 'bin_designer')?.status === 'graduated') {
      expect(hasBinDesigner).toBe(true);
    }
  });

  it('excludes experimental features', () => {
    const graduated = getGraduatedFeatures();
    const hasExperimental = graduated.some((f) => f.status === 'experimental');
    expect(hasExperimental).toBe(false);
  });

  it('excludes preview features', () => {
    const graduated = getGraduatedFeatures();
    const hasPreview = graduated.some((f) => f.status === 'preview');
    expect(hasPreview).toBe(false);
  });

  it('excludes deprecated features', () => {
    const graduated = getGraduatedFeatures();
    const hasDeprecated = graduated.some((f) => f.status === 'deprecated');
    expect(hasDeprecated).toBe(false);
  });

  it('returns features from FEATURE_FLAGS only', () => {
    const graduated = getGraduatedFeatures();
    graduated.forEach((feature) => {
      expect(FEATURE_FLAGS).toContain(feature);
    });
  });

  it('has no duplicates', () => {
    const graduated = getGraduatedFeatures();
    const ids = graduated.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('returns exactly the expected number of graduated features', () => {
    const graduated = getGraduatedFeatures();
    const expectedCount = FEATURE_FLAGS.filter((f) => f.status === 'graduated').length;
    expect(graduated.length).toBe(expectedCount);
  });

  it('all returned features have graduatedAt property', () => {
    const graduated = getGraduatedFeatures();
    graduated.forEach((feature) => {
      expect(feature.graduatedAt).toBeDefined();
    });
  });
});

describe('getToggleableFeatures()', () => {
  it('returns array of features', () => {
    const toggleable = getToggleableFeatures();
    expect(Array.isArray(toggleable)).toBe(true);
  });

  it('returns only experimental and preview features', () => {
    const toggleable = getToggleableFeatures();
    toggleable.forEach((feature) => {
      expect(['experimental', 'preview']).toContain(feature.status);
    });
  });

  it('excludes graduated features', () => {
    const toggleable = getToggleableFeatures();
    const hasGraduated = toggleable.some((f) => f.status === 'graduated');
    expect(hasGraduated).toBe(false);
  });

  it('excludes deprecated features', () => {
    const toggleable = getToggleableFeatures();
    const hasDeprecated = toggleable.some((f) => f.status === 'deprecated');
    expect(hasDeprecated).toBe(false);
  });

  it('includes collaborative_editing if it is experimental', () => {
    const toggleable = getToggleableFeatures();
    const hasCollaborative = toggleable.some((f) => f.id === 'collaborative_editing');
    if (FEATURE_FLAGS.find((f) => f.id === 'collaborative_editing')?.status === 'experimental') {
      expect(hasCollaborative).toBe(true);
    }
  });

  it('returns features from FEATURE_FLAGS only', () => {
    const toggleable = getToggleableFeatures();
    toggleable.forEach((feature) => {
      expect(FEATURE_FLAGS).toContain(feature);
    });
  });

  it('has no duplicates', () => {
    const toggleable = getToggleableFeatures();
    const ids = toggleable.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('returns exactly the expected number of toggleable features', () => {
    const toggleable = getToggleableFeatures();
    const expectedCount = FEATURE_FLAGS.filter(
      (f) => f.status === 'experimental' || f.status === 'preview'
    ).length;
    expect(toggleable.length).toBe(expectedCount);
  });
});

describe('FeatureId type', () => {
  it('is properly derived from FEATURE_FLAGS ids', () => {
    const binDesignerId: FeatureId = 'bin_designer';
    const collaborativeId: FeatureId = 'collaborative_editing';
    const layoutToPrintId: FeatureId = 'layout_to_print';

    expect(binDesignerId).toBe('bin_designer');
    expect(collaborativeId).toBe('collaborative_editing');
    expect(layoutToPrintId).toBe('layout_to_print');
  });
});

describe('Feature filtering consistency', () => {
  it('all active features are either experimental, preview, or graduated', () => {
    const active = getActiveFeatures();
    active.forEach((feature) => {
      expect(['experimental', 'preview', 'graduated']).toContain(feature.status);
    });
  });

  it('graduated + toggleable covers all active features', () => {
    const graduated = getGraduatedFeatures();
    const toggleable = getToggleableFeatures();
    const active = getActiveFeatures();

    const combined = new Set([...graduated, ...toggleable].map((f) => f.id));
    const activeIds = new Set(active.map((f) => f.id));

    expect(combined).toEqual(activeIds);
  });

  it('graduated and toggleable do not overlap', () => {
    const graduated = getGraduatedFeatures();
    const toggleable = getToggleableFeatures();

    const graduatedIds = new Set(graduated.map((f) => f.id));
    const toggleableIds = new Set(toggleable.map((f) => f.id));

    const intersection = new Set([...graduatedIds].filter((id) => toggleableIds.has(id)));
    expect(intersection.size).toBe(0);
  });

  it('all features are either active or deprecated', () => {
    const active = getActiveFeatures();
    const activeIds = new Set(active.map((f) => f.id));

    FEATURE_FLAGS.forEach((feature) => {
      if (feature.status === 'deprecated') {
        expect(activeIds.has(feature.id)).toBe(false);
      } else {
        expect(activeIds.has(feature.id)).toBe(true);
      }
    });
  });
});
