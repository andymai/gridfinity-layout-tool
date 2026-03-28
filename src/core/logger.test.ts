import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogger, logger } from './logger';

describe('logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('createLogger', () => {
    it('creates a logger with warn and debug methods', () => {
      const log = createLogger('Test');
      expect(typeof log.warn).toBe('function');
      expect(typeof log.debug).toBe('function');
    });

    it('warn prefixes message with tag', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const log = createLogger('MyTag');
      log.warn('something broke');
      expect(warnSpy).toHaveBeenCalledWith('[MyTag] something broke');
    });

    it('warn includes context when provided', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const log = createLogger('DB');
      const ctx = { table: 'events', count: 42 };
      log.warn('quota exceeded', ctx);
      expect(warnSpy).toHaveBeenCalledWith('[DB] quota exceeded', ctx);
    });

    it('debug prefixes message with tag', () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const log = createLogger('Cache');
      log.debug('cache hit');
      expect(debugSpy).toHaveBeenCalledWith('[Cache] cache hit');
    });

    it('debug includes context when provided', () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const log = createLogger('Cache');
      const ctx = { key: 'layout-1' };
      log.debug('cache miss', ctx);
      expect(debugSpy).toHaveBeenCalledWith('[Cache] cache miss', ctx);
    });
  });

  describe('default logger', () => {
    it('uses App tag', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('test');
      expect(warnSpy).toHaveBeenCalledWith('[App] test');
    });
  });
});
