/**
 * CutoutLibrary storage tests.
 *
 * Tests IndexedDB persistence for cutout templates.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  saveCutoutTemplate,
  loadCutoutTemplates,
  loadCutoutTemplate,
  deleteCutoutTemplate,
  updateCutoutTemplate,
  generateUniqueName,
  clearCutoutLibrary,
  closeCutoutDatabase,
} from './CutoutLibrary';
import type { TracedContour, CutoutTemplate } from '../types';
import { MAX_CUTOUT_TEMPLATES, MAX_CONTOUR_POINTS } from '../types';

// Test fixtures
function createTestContour(pointCount = 4): TracedContour {
  const points = Array.from({ length: pointCount }, (_, i) => ({
    x: Math.cos((i / pointCount) * Math.PI * 2) * 0.5 + 0.5,
    y: Math.sin((i / pointCount) * Math.PI * 2) * 0.5 + 0.5,
  }));
  return {
    points,
    boundingBox: { width: 100, height: 100 },
    area: 0.5,
  };
}

function createTestTemplate(
  overrides: Partial<CutoutTemplate> = {}
): Omit<CutoutTemplate, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'Test Wrench',
    contour: createTestContour(),
    thumbnail: 'data:image/jpeg;base64,test',
    originalImage: 'data:image/png;base64,test',
    widthMm: 150,
    heightMm: 40,
    ...overrides,
  };
}

describe('CutoutLibrary', () => {
  beforeEach(async () => {
    closeCutoutDatabase();
  });

  afterEach(async () => {
    try {
      closeCutoutDatabase();
      await clearCutoutLibrary();
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('saveCutoutTemplate', () => {
    it('saves a template and returns its ID', async () => {
      const template = createTestTemplate();

      const result = await saveCutoutTemplate(template);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeDefined();
        expect(typeof result.value).toBe('string');
      }
    });

    it('saves template with all properties', async () => {
      const template = createTestTemplate({
        name: 'My Screwdriver',
        widthMm: 200,
        heightMm: 30,
        category: 'screwdrivers',
      });

      const result = await saveCutoutTemplate(template);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const loaded = await loadCutoutTemplate(result.value);
      expect(loaded).not.toBeNull();
      expect(loaded?.name).toBe('My Screwdriver');
      expect(loaded?.widthMm).toBe(200);
      expect(loaded?.heightMm).toBe(30);
      expect(loaded?.category).toBe('screwdrivers');
    });

    it('generates createdAt and updatedAt timestamps', async () => {
      const template = createTestTemplate();

      const result = await saveCutoutTemplate(template);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const loaded = await loadCutoutTemplate(result.value);
      expect(loaded).not.toBeNull();
      if (!loaded) return;

      expect(loaded.createdAt).toBeDefined();
      expect(loaded.updatedAt).toBeDefined();
      expect(new Date(loaded.createdAt).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('rejects template with too many contour points', async () => {
      const template = createTestTemplate({
        contour: createTestContour(MAX_CONTOUR_POINTS + 10),
      });

      const result = await saveCutoutTemplate(template);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('validation_error');
        expect(result.error.message).toContain('too complex');
      }
    });

    it('rejects when library is full', async () => {
      // Save maximum number of templates
      for (let i = 0; i < MAX_CUTOUT_TEMPLATES; i++) {
        const result = await saveCutoutTemplate(createTestTemplate({ name: `Tool ${i}` }));
        expect(result.ok).toBe(true);
      }

      // Try to save one more
      const result = await saveCutoutTemplate(createTestTemplate({ name: 'One Too Many' }));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('storage_full');
      }
    });

    it('saves template without thumbnail or original image', async () => {
      const template = createTestTemplate({
        thumbnail: null,
        originalImage: null,
      });

      const result = await saveCutoutTemplate(template);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const loaded = await loadCutoutTemplate(result.value);
      expect(loaded?.thumbnail).toBeNull();
      expect(loaded?.originalImage).toBeNull();
    });
  });

  describe('loadCutoutTemplates', () => {
    it('returns empty array when no templates exist', async () => {
      const templates = await loadCutoutTemplates();

      expect(templates).toEqual([]);
    });

    it('returns all saved templates', async () => {
      await saveCutoutTemplate(createTestTemplate({ name: 'Wrench' }));
      await saveCutoutTemplate(createTestTemplate({ name: 'Screwdriver' }));
      await saveCutoutTemplate(createTestTemplate({ name: 'Pliers' }));

      const templates = await loadCutoutTemplates();

      expect(templates).toHaveLength(3);
      const names = templates.map((t) => t.name);
      expect(names).toContain('Wrench');
      expect(names).toContain('Screwdriver');
      expect(names).toContain('Pliers');
    });

    it('sorts templates by createdAt descending (newest first)', async () => {
      const result1 = await saveCutoutTemplate(createTestTemplate({ name: 'First' }));
      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
      const result2 = await saveCutoutTemplate(createTestTemplate({ name: 'Second' }));
      await new Promise((resolve) => setTimeout(resolve, 10));
      const result3 = await saveCutoutTemplate(createTestTemplate({ name: 'Third' }));

      expect(result1.ok && result2.ok && result3.ok).toBe(true);

      const templates = await loadCutoutTemplates();

      expect(templates[0].name).toBe('Third');
      expect(templates[1].name).toBe('Second');
      expect(templates[2].name).toBe('First');
    });
  });

  describe('loadCutoutTemplate', () => {
    it('returns null for non-existent template', async () => {
      const template = await loadCutoutTemplate('non-existent-id');

      expect(template).toBeNull();
    });

    it('loads a saved template by ID', async () => {
      const result = await saveCutoutTemplate(createTestTemplate({ name: 'Specific Tool' }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const loaded = await loadCutoutTemplate(result.value);

      expect(loaded).not.toBeNull();
      expect(loaded?.name).toBe('Specific Tool');
      expect(loaded?.id).toBe(result.value);
    });
  });

  describe('deleteCutoutTemplate', () => {
    it('removes template from library', async () => {
      const result = await saveCutoutTemplate(createTestTemplate({ name: 'To Delete' }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      await deleteCutoutTemplate(result.value);

      const loaded = await loadCutoutTemplate(result.value);
      expect(loaded).toBeNull();
    });

    it('does not throw when deleting non-existent template', async () => {
      await expect(deleteCutoutTemplate('non-existent')).resolves.not.toThrow();
    });

    it('only removes specified template', async () => {
      const result1 = await saveCutoutTemplate(createTestTemplate({ name: 'Keep' }));
      const result2 = await saveCutoutTemplate(createTestTemplate({ name: 'Delete' }));
      expect(result1.ok && result2.ok).toBe(true);
      if (!result1.ok || !result2.ok) return;

      await deleteCutoutTemplate(result2.value);

      expect(await loadCutoutTemplate(result1.value)).not.toBeNull();
      expect(await loadCutoutTemplate(result2.value)).toBeNull();
    });
  });

  describe('updateCutoutTemplate', () => {
    it('updates template name', async () => {
      const result = await saveCutoutTemplate(createTestTemplate({ name: 'Original' }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const updateResult = await updateCutoutTemplate(result.value, { name: 'Updated' });

      expect(updateResult.ok).toBe(true);
      const loaded = await loadCutoutTemplate(result.value);
      expect(loaded?.name).toBe('Updated');
    });

    it('updates updatedAt timestamp', async () => {
      const result = await saveCutoutTemplate(createTestTemplate());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const original = await loadCutoutTemplate(result.value);
      expect(original).not.toBeNull();
      if (!original) return;
      const originalUpdatedAt = original.updatedAt;

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 10));

      await updateCutoutTemplate(result.value, { name: 'Changed' });

      const updated = await loadCutoutTemplate(result.value);
      expect(updated).not.toBeNull();
      if (!updated) return;

      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime()
      );
    });

    it('preserves createdAt timestamp', async () => {
      const result = await saveCutoutTemplate(createTestTemplate());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const original = await loadCutoutTemplate(result.value);
      const originalCreatedAt = original?.createdAt;

      await updateCutoutTemplate(result.value, { name: 'Changed' });

      const updated = await loadCutoutTemplate(result.value);
      expect(updated?.createdAt).toBe(originalCreatedAt);
    });

    it('updates dimensions', async () => {
      const result = await saveCutoutTemplate(createTestTemplate({ widthMm: 100, heightMm: 50 }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      await updateCutoutTemplate(result.value, { widthMm: 200, heightMm: 75 });

      const loaded = await loadCutoutTemplate(result.value);
      expect(loaded?.widthMm).toBe(200);
      expect(loaded?.heightMm).toBe(75);
    });

    it('updates category', async () => {
      const result = await saveCutoutTemplate(createTestTemplate());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      await updateCutoutTemplate(result.value, { category: 'power-tools' });

      const loaded = await loadCutoutTemplate(result.value);
      expect(loaded?.category).toBe('power-tools');
    });

    it('returns error for non-existent template', async () => {
      const result = await updateCutoutTemplate('non-existent', { name: 'New Name' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('not_found');
      }
    });
  });

  describe('generateUniqueName', () => {
    it('returns original name when no duplicates exist', async () => {
      const name = await generateUniqueName('Wrench');

      expect(name).toBe('Wrench');
    });

    it('adds suffix when name exists', async () => {
      await saveCutoutTemplate(createTestTemplate({ name: 'Wrench' }));

      const name = await generateUniqueName('Wrench');

      expect(name).toBe('Wrench (2)');
    });

    it('increments suffix for multiple duplicates', async () => {
      await saveCutoutTemplate(createTestTemplate({ name: 'Wrench' }));
      await saveCutoutTemplate(createTestTemplate({ name: 'Wrench (2)' }));
      await saveCutoutTemplate(createTestTemplate({ name: 'Wrench (3)' }));

      const name = await generateUniqueName('Wrench');

      expect(name).toBe('Wrench (4)');
    });

    it('handles names that already have suffixes', async () => {
      await saveCutoutTemplate(createTestTemplate({ name: 'Tool (2)' }));

      const name = await generateUniqueName('Tool (2)');

      expect(name).toBe('Tool (2) (2)');
    });
  });

  describe('clearCutoutLibrary', () => {
    it('removes all templates', async () => {
      await saveCutoutTemplate(createTestTemplate({ name: 'Tool 1' }));
      await saveCutoutTemplate(createTestTemplate({ name: 'Tool 2' }));
      await saveCutoutTemplate(createTestTemplate({ name: 'Tool 3' }));

      await clearCutoutLibrary();

      const templates = await loadCutoutTemplates();
      expect(templates).toEqual([]);
    });

    it('allows saving after clearing', async () => {
      await saveCutoutTemplate(createTestTemplate({ name: 'Before' }));
      await clearCutoutLibrary();

      const result = await saveCutoutTemplate(createTestTemplate({ name: 'After' }));
      expect(result.ok).toBe(true);

      const templates = await loadCutoutTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('After');
    });
  });

  describe('edge cases', () => {
    it('handles empty template name', async () => {
      const result = await saveCutoutTemplate(createTestTemplate({ name: '' }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const loaded = await loadCutoutTemplate(result.value);
      expect(loaded?.name).toBe('');
    });

    it('handles unicode in template name', async () => {
      const result = await saveCutoutTemplate(
        createTestTemplate({ name: 'Schraubenzieher 🔧 螺丝刀' })
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const loaded = await loadCutoutTemplate(result.value);
      expect(loaded?.name).toBe('Schraubenzieher 🔧 螺丝刀');
    });

    it('handles template with minimal contour (3 points)', async () => {
      const result = await saveCutoutTemplate(
        createTestTemplate({ contour: createTestContour(3) })
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const loaded = await loadCutoutTemplate(result.value);
      expect(loaded?.contour.points).toHaveLength(3);
    });

    it('handles very long template names', async () => {
      const longName = 'A'.repeat(200);
      const result = await saveCutoutTemplate(createTestTemplate({ name: longName }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const loaded = await loadCutoutTemplate(result.value);
      expect(loaded?.name).toBe(longName);
    });

    it('handles large base64 image data', async () => {
      // Simulate a larger image (~50KB of base64)
      const largeBase64 = 'data:image/png;base64,' + 'A'.repeat(50000);
      const result = await saveCutoutTemplate(createTestTemplate({ originalImage: largeBase64 }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const loaded = await loadCutoutTemplate(result.value);
      expect(loaded?.originalImage).toBe(largeBase64);
    });
  });
});
