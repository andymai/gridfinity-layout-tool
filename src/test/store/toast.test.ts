import { describe, it, expect, beforeEach } from 'vitest';
import { useToastStore } from '../../store/toast';

describe('toast store', () => {
  beforeEach(() => {
    // Reset store
    useToastStore.setState({ toasts: [] });
  });

  describe('addToast', () => {
    it('adds a toast with generated id and default duration', () => {
      const { addToast } = useToastStore.getState();

      addToast('Test message', 'success');

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe('Test message');
      expect(toasts[0].type).toBe('success');
      expect(toasts[0].id).toBeDefined();
      expect(toasts[0].duration).toBe(5000);
      expect(toasts[0].createdAt).toBeDefined();
    });

    it('adds toast with custom duration', () => {
      const { addToast } = useToastStore.getState();

      addToast('Custom duration', 'info', 10000);

      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].duration).toBe(10000);
    });

    it('adds toast with zero duration (no auto-dismiss)', () => {
      const { addToast } = useToastStore.getState();

      addToast('Persistent toast', 'error', 0);

      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].duration).toBe(0);
    });

    it('adds multiple toasts', () => {
      const { addToast } = useToastStore.getState();

      addToast('First', 'success');
      addToast('Second', 'error');
      addToast('Third', 'info');

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(3);
      expect(toasts[0].message).toBe('First');
      expect(toasts[1].message).toBe('Second');
      expect(toasts[2].message).toBe('Third');
    });

    it('limits toasts to maximum of 3, removing oldest', () => {
      const { addToast } = useToastStore.getState();

      addToast('First', 'success');
      addToast('Second', 'success');
      addToast('Third', 'success');
      addToast('Fourth', 'success');

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(3);
      expect(toasts[0].message).toBe('Second');
      expect(toasts[1].message).toBe('Third');
      expect(toasts[2].message).toBe('Fourth');
    });

    it('generates unique ids', () => {
      const { addToast } = useToastStore.getState();

      addToast('First', 'success');
      addToast('Second', 'success');

      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].id).not.toBe(toasts[1].id);
    });

    it('sets createdAt timestamp', () => {
      const { addToast } = useToastStore.getState();
      const before = Date.now();

      addToast('Test', 'info');

      const after = Date.now();
      const toast = useToastStore.getState().toasts[0];
      expect(toast.createdAt).toBeGreaterThanOrEqual(before);
      expect(toast.createdAt).toBeLessThanOrEqual(after);
    });
  });

  describe('removeToast', () => {
    it('removes specific toast by id', () => {
      const { addToast, removeToast } = useToastStore.getState();

      addToast('First', 'success');
      addToast('Second', 'error');

      const toasts = useToastStore.getState().toasts;
      const firstId = toasts[0].id;

      removeToast(firstId);

      const updatedToasts = useToastStore.getState().toasts;
      expect(updatedToasts).toHaveLength(1);
      expect(updatedToasts[0].message).toBe('Second');
    });

    it('does nothing for non-existent id', () => {
      const { addToast, removeToast } = useToastStore.getState();

      addToast('Test', 'success');
      removeToast('non-existent-id');

      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
  });

  describe('toast types', () => {
    it('supports success type', () => {
      const { addToast } = useToastStore.getState();

      addToast('Success!', 'success');

      expect(useToastStore.getState().toasts[0].type).toBe('success');
    });

    it('supports error type', () => {
      const { addToast } = useToastStore.getState();

      addToast('Error!', 'error');

      expect(useToastStore.getState().toasts[0].type).toBe('error');
    });

    it('supports info type', () => {
      const { addToast } = useToastStore.getState();

      addToast('Info!', 'info');

      expect(useToastStore.getState().toasts[0].type).toBe('info');
    });
  });
});
