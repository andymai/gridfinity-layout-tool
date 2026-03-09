import { describe, it, expect } from 'vitest';
import { createCommand } from './index';
import { correlationId } from '../types';

describe('createCommand', () => {
  it('creates a command with auto-generated metadata', () => {
    const cmd = createCommand('bin.delete', { id: 'bin_1' as never });

    expect(cmd.type).toBe('bin.delete');
    expect(cmd.payload.id).toBe('bin_1');
    expect(cmd.meta.id).toMatch(/^cmd_/);
    expect(cmd.meta.correlationId).toMatch(/^cor_/);
    expect(cmd.meta.source).toBe('user');
    expect(cmd.meta.timestamp).toBeGreaterThan(0);
  });

  it('uses provided source', () => {
    const cmd = createCommand('layer.add', {}, { source: 'system' });
    expect(cmd.meta.source).toBe('system');
  });

  it('uses provided correlationId', () => {
    const corId = correlationId('custom_correlation');
    const cmd = createCommand('layer.add', {}, { correlationId: corId });
    expect(cmd.meta.correlationId).toBe('custom_correlation');
  });

  it('generates unique command IDs', () => {
    const cmd1 = createCommand('layer.add', {});
    const cmd2 = createCommand('layer.add', {});
    expect(cmd1.meta.id).not.toBe(cmd2.meta.id);
  });
});
