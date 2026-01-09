import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useToastStore } from '../../store/toast';

describe('toast store', () => {
  beforeEach(() => {
    // Reset store
    useToastStore.setState({ toasts: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('addToast', () => {
    it('adds a toast with generated id', () => {
      const { addToast } = useToastStore.getState();

      addToast('Test message', 'success');

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe('Test message');
      expect(toasts[0].type).toBe('success');
      expect(toasts[0].id).toBeDefined();
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

    it('auto-removes toast after 5 seconds', () => {
      const { addToast } = useToastStore.getState();

      addToast('Auto-remove me', 'info');
      expect(useToastStore.getState().toasts).toHaveLength(1);

      vi.advanceTimersByTime(5000);

      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('removes correct toast when multiple exist', () => {
      const { addToast } = useToastStore.getState();

      addToast('First', 'success');
      vi.advanceTimersByTime(2000);

      addToast('Second', 'error');
      vi.advanceTimersByTime(2000);

      addToast('Third', 'info');

      // At this point:
      // - First: 4000ms elapsed (1000ms remaining)
      // - Second: 2000ms elapsed (3000ms remaining)
      // - Third: 0ms elapsed (5000ms remaining)
      expect(useToastStore.getState().toasts).toHaveLength(3);

      vi.advanceTimersByTime(1000);
      // First should be removed now
      expect(useToastStore.getState().toasts).toHaveLength(2);
      expect(useToastStore.getState().toasts[0].message).toBe('Second');

      vi.advanceTimersByTime(2000);
      // Second should be removed now
      expect(useToastStore.getState().toasts).toHaveLength(1);
      expect(useToastStore.getState().toasts[0].message).toBe('Third');
    });

    it('generates unique ids', () => {
      const { addToast } = useToastStore.getState();

      addToast('First', 'success');
      addToast('Second', 'success');

      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].id).not.toBe(toasts[1].id);
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

    it('can remove toast before auto-remove timeout', () => {
      const { addToast, removeToast } = useToastStore.getState();

      addToast('Quick remove', 'info');
      const id = useToastStore.getState().toasts[0].id;

      vi.advanceTimersByTime(1000); // Only 1 second elapsed
      removeToast(id);

      expect(useToastStore.getState().toasts).toHaveLength(0);

      // Even after the timeout would have fired, no errors
      vi.advanceTimersByTime(5000);
      expect(useToastStore.getState().toasts).toHaveLength(0);
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
