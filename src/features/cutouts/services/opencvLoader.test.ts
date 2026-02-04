/**
 * OpenCV loader tests.
 *
 * Tests the lazy loading of OpenCV.js for image processing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadOpenCV, isOpenCVReady, resetOpenCVState, getCV } from './opencvLoader';
import type { OpenCVLoadProgress } from '../types';

describe('opencvLoader', () => {
  beforeEach(() => {
    resetOpenCVState();
  });

  afterEach(() => {
    resetOpenCVState();
  });

  describe('isOpenCVReady', () => {
    it('returns false before loading', () => {
      expect(isOpenCVReady()).toBe(false);
    });

    it('returns true after successful load', async () => {
      await loadOpenCV();
      expect(isOpenCVReady()).toBe(true);
    });
  });

  describe('getCV', () => {
    it('throws when not loaded', () => {
      expect(() => getCV()).toThrow('OpenCV not loaded');
    });

    it('returns cv module after loading', async () => {
      await loadOpenCV();
      const cv = getCV();
      expect(cv).toBeDefined();
      expect(typeof cv.Mat).toBe('function');
    });
  });

  describe('loadOpenCV', () => {
    it('calls progress callback with downloading stage', async () => {
      const progressStages: OpenCVLoadProgress[] = [];
      const onProgress = (progress: OpenCVLoadProgress) => {
        progressStages.push({ ...progress });
      };

      await loadOpenCV(onProgress);

      // Should have called with downloading stage
      expect(progressStages.some((p) => p.stage === 'downloading')).toBe(true);
    });

    it('reports ready stage after successful load', async () => {
      const progressStages: OpenCVLoadProgress[] = [];
      const onProgress = (progress: OpenCVLoadProgress) => {
        progressStages.push({ ...progress });
      };

      const result = await loadOpenCV(onProgress);

      expect(result.ok).toBe(true);
      expect(progressStages.some((p) => p.stage === 'ready')).toBe(true);
      expect(progressStages[progressStages.length - 1].progress).toBe(100);
    });

    it('returns ok result on success', async () => {
      const result = await loadOpenCV();
      expect(result.ok).toBe(true);
    });

    it('returns cached result when already loaded', async () => {
      // First load
      const result1 = await loadOpenCV();
      expect(result1.ok).toBe(true);

      // Second load should return immediately
      const progressStages: OpenCVLoadProgress[] = [];
      const result2 = await loadOpenCV((p) => progressStages.push({ ...p }));

      expect(result2.ok).toBe(true);
      // Should immediately report ready (no downloading)
      expect(progressStages.length).toBe(1);
      expect(progressStages[0].stage).toBe('ready');
    });

    it('only loads once even when called multiple times concurrently', async () => {
      // Start multiple loads concurrently
      const promises = [loadOpenCV(), loadOpenCV(), loadOpenCV()];

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((r) => expect(r.ok).toBe(true));
    });

    it('provides mock cv object with expected methods in test mode', async () => {
      await loadOpenCV();
      const cv = getCV();

      // Check mock has expected methods
      expect(typeof cv.cvtColor).toBe('function');
      expect(typeof cv.GaussianBlur).toBe('function');
      expect(typeof cv.threshold).toBe('function');
      expect(typeof cv.findContours).toBe('function');
      expect(typeof cv.contourArea).toBe('function');
      expect(typeof cv.approxPolyDP).toBe('function');
      expect(typeof cv.boundingRect).toBe('function');
      expect(typeof cv.matFromImageData).toBe('function');

      // Check constants
      expect(cv.COLOR_RGBA2GRAY).toBeDefined();
      expect(cv.THRESH_BINARY).toBeDefined();
      expect(cv.RETR_EXTERNAL).toBeDefined();
      expect(cv.CHAIN_APPROX_SIMPLE).toBeDefined();
    });
  });
});
