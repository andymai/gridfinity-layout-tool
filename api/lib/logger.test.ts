import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  beforeEach(() => {
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  it('outputs structured JSON for info level', () => {
    logger.info('test message');

    expect(console.log).toHaveBeenCalledOnce();
    const output = JSON.parse((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(output.level).toBe('info');
    expect(output.message).toBe('test message');
    expect(output.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(output.context).toBeUndefined();
  });

  it('outputs structured JSON for warn level', () => {
    logger.warn('warning message');

    expect(console.warn).toHaveBeenCalledOnce();
    const output = JSON.parse((console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(output.level).toBe('warn');
    expect(output.message).toBe('warning message');
  });

  it('outputs structured JSON for error level', () => {
    logger.error('error message');

    expect(console.error).toHaveBeenCalledOnce();
    const output = JSON.parse((console.error as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(output.level).toBe('error');
    expect(output.message).toBe('error message');
  });

  it('includes context when provided', () => {
    logger.error('failed', { endpoint: '/api/share', statusCode: 500 });

    const output = JSON.parse((console.error as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(output.context).toEqual({ endpoint: '/api/share', statusCode: 500 });
  });

  it('omits context key when not provided', () => {
    logger.info('no context');

    const output = JSON.parse((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(output).not.toHaveProperty('context');
  });

  it('timestamp is ISO 8601 format', () => {
    logger.info('time check');

    const output = JSON.parse((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(() => new Date(output.timestamp)).not.toThrow();
    expect(new Date(output.timestamp).toISOString()).toBe(output.timestamp);
  });

  it('falls back gracefully when context is non-serializable', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    logger.error('circular ref', circular);

    expect(console.error).toHaveBeenCalledOnce();
    const output = JSON.parse((console.error as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(output.level).toBe('error');
    expect(output.message).toBe('circular ref');
    expect(output.context).toBeUndefined();
  });
});
