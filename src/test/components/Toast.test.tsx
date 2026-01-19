import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastContainer } from '@/shared/components/Toast/Toast';
import { useToastStore } from '@/core/store/toast';

// Mock useResponsive hook
vi.mock('@/shared/hooks', () => ({
  useResponsive: vi.fn(() => ({ isMobile: false })),
}));

import { useResponsive } from '@/shared/hooks';

const mockUseResponsive = useResponsive as ReturnType<typeof vi.fn>;

describe('Toast Store', () => {
  beforeEach(() => {
    // Reset store state
    useToastStore.setState({ toasts: [] });
  });

  describe('addToast', () => {
    it('adds toast with legacy positional arguments', () => {
      const { addToast } = useToastStore.getState();

      addToast('Test message', 'success');

      const { toasts } = useToastStore.getState();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe('Test message');
      expect(toasts[0].type).toBe('success');
    });

    it('adds toast with object API', () => {
      const { addToast } = useToastStore.getState();

      addToast({ message: 'Object API', type: 'error' });

      const { toasts } = useToastStore.getState();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe('Object API');
      expect(toasts[0].type).toBe('error');
    });

    it('uses default duration when not specified', () => {
      const { addToast } = useToastStore.getState();

      addToast('Default duration', 'info');

      const { toasts } = useToastStore.getState();
      expect(toasts[0].duration).toBe(5000); // DEFAULT_DURATION
    });

    it('accepts custom duration', () => {
      const { addToast } = useToastStore.getState();

      addToast('Custom duration', 'info', 10000);

      const { toasts } = useToastStore.getState();
      expect(toasts[0].duration).toBe(10000);
    });

    it('accepts action in object API', () => {
      const { addToast } = useToastStore.getState();
      const onClick = vi.fn();

      addToast({
        message: 'With action',
        type: 'info',
        action: { label: 'Undo', onClick },
      });

      const { toasts } = useToastStore.getState();
      expect(toasts[0].action?.label).toBe('Undo');
      expect(toasts[0].action?.onClick).toBe(onClick);
    });

    it('generates unique IDs for each toast', () => {
      const { addToast } = useToastStore.getState();

      addToast('First', 'info');
      addToast('Second', 'info');

      const { toasts } = useToastStore.getState();
      expect(toasts[0].id).not.toBe(toasts[1].id);
    });

    it('limits toasts to MAX_TOASTS (3)', () => {
      const { addToast } = useToastStore.getState();

      addToast('First', 'info');
      addToast('Second', 'info');
      addToast('Third', 'info');
      addToast('Fourth', 'info');

      const { toasts } = useToastStore.getState();
      expect(toasts).toHaveLength(3);
      // Oldest toast should be removed
      expect(toasts.find((t) => t.message === 'First')).toBeUndefined();
      expect(toasts.find((t) => t.message === 'Fourth')).toBeDefined();
    });

    it('sets createdAt timestamp', () => {
      const before = Date.now();
      const { addToast } = useToastStore.getState();

      addToast('Timestamped', 'info');

      const { toasts } = useToastStore.getState();
      const after = Date.now();
      expect(toasts[0].createdAt).toBeGreaterThanOrEqual(before);
      expect(toasts[0].createdAt).toBeLessThanOrEqual(after);
    });

    it('defaults to info type when using object API without type', () => {
      const { addToast } = useToastStore.getState();

      // Legacy API with undefined type defaults to 'info'
      addToast('No type', undefined as unknown as 'info');

      const { toasts } = useToastStore.getState();
      expect(toasts[0].type).toBe('info');
    });
  });

  describe('removeToast', () => {
    it('removes toast by ID', () => {
      const { addToast } = useToastStore.getState();

      addToast('To remove', 'info');
      const { toasts: beforeRemove } = useToastStore.getState();
      const toastId = beforeRemove[0].id;

      const { removeToast } = useToastStore.getState();
      removeToast(toastId);

      const { toasts: afterRemove } = useToastStore.getState();
      expect(afterRemove).toHaveLength(0);
    });

    it('only removes specified toast', () => {
      const { addToast } = useToastStore.getState();

      addToast('Keep', 'info');
      addToast('Remove', 'error');

      const { toasts } = useToastStore.getState();
      const removeId = toasts.find((t) => t.message === 'Remove')!.id;

      const { removeToast } = useToastStore.getState();
      removeToast(removeId);

      const { toasts: afterRemove } = useToastStore.getState();
      expect(afterRemove).toHaveLength(1);
      expect(afterRemove[0].message).toBe('Keep');
    });

    it('does nothing when ID not found', () => {
      const { addToast } = useToastStore.getState();

      addToast('Existing', 'info');

      const { removeToast } = useToastStore.getState();
      removeToast('non-existent-id');

      const { toasts } = useToastStore.getState();
      expect(toasts).toHaveLength(1);
    });
  });
});

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ toasts: [] });
    mockUseResponsive.mockReturnValue({ isMobile: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('returns null when no toasts', () => {
      const { container } = render(<ToastContainer />);
      expect(container.firstChild).toBeNull();
    });

    it('renders toasts from store', () => {
      useToastStore.getState().addToast('Hello world', 'success');

      render(<ToastContainer />);

      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('renders multiple toasts', () => {
      useToastStore.getState().addToast('First toast', 'info');
      useToastStore.getState().addToast('Second toast', 'success');

      render(<ToastContainer />);

      expect(screen.getByText('First toast')).toBeInTheDocument();
      expect(screen.getByText('Second toast')).toBeInTheDocument();
    });

    it('has role="region" for accessibility', () => {
      useToastStore.getState().addToast('Test', 'info');

      render(<ToastContainer />);

      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('has aria-label for screen readers', () => {
      useToastStore.getState().addToast('Test', 'info');

      render(<ToastContainer />);

      expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    });
  });

  describe('toast types', () => {
    it('renders success toast with correct role', () => {
      useToastStore.getState().addToast('Success!', 'success');

      render(<ToastContainer />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders error toast', () => {
      useToastStore.getState().addToast('Error!', 'error');

      render(<ToastContainer />);

      expect(screen.getByText('Error!')).toBeInTheDocument();
    });

    it('renders info toast', () => {
      useToastStore.getState().addToast('Info!', 'info');

      render(<ToastContainer />);

      expect(screen.getByText('Info!')).toBeInTheDocument();
    });
  });

  describe('dismissal', () => {
    it('removes toast when close button clicked', () => {
      useToastStore.getState().addToast('Dismissible', 'info');

      render(<ToastContainer />);

      expect(screen.getByText('Dismissible')).toBeInTheDocument();

      const closeButton = screen.getByLabelText('Dismiss notification');
      fireEvent.click(closeButton);

      // Wait for exit animation (150ms) and removal
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // After animation, store should have toast removed
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('auto-dismisses after duration', () => {
      useToastStore
        .getState()
        .addToast({ message: 'Auto dismiss', type: 'info', duration: 3000 });

      render(<ToastContainer />);

      expect(screen.getByText('Auto dismiss')).toBeInTheDocument();

      // Advance past duration + animation
      act(() => {
        vi.advanceTimersByTime(3200);
      });

      // Store should have toast removed
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('does not auto-dismiss when duration is 0', () => {
      useToastStore
        .getState()
        .addToast({ message: 'Persistent', type: 'info', duration: 0 });

      render(<ToastContainer />);

      // Advance well past default duration
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Should still be in store
      expect(useToastStore.getState().toasts).toHaveLength(1);
      expect(screen.getByText('Persistent')).toBeInTheDocument();
    });
  });

  describe('hover behavior', () => {
    it('pauses timer on mouse enter', () => {
      useToastStore
        .getState()
        .addToast({ message: 'Pausable', type: 'info', duration: 2000 });

      render(<ToastContainer />);

      const toast = screen.getByRole('alert');

      // Advance halfway through duration
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Hover to pause
      fireEvent.mouseEnter(toast);

      // Advance past original duration
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Should still be in store because timer was paused
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });

    it('resumes timer on mouse leave', () => {
      useToastStore
        .getState()
        .addToast({ message: 'Resumable', type: 'info', duration: 2000 });

      render(<ToastContainer />);

      const toast = screen.getByRole('alert');

      // Advance halfway
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Pause
      fireEvent.mouseEnter(toast);

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Resume
      fireEvent.mouseLeave(toast);

      // Should still have ~1000ms remaining
      act(() => {
        vi.advanceTimersByTime(800);
      });

      // Still in store
      expect(useToastStore.getState().toasts).toHaveLength(1);

      // After remaining time + animation
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Now should be removed from store
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });
  });

  describe('action button', () => {
    it('renders action button when provided', () => {
      useToastStore.getState().addToast({
        message: 'With action',
        type: 'info',
        action: { label: 'Undo', onClick: vi.fn() },
      });

      render(<ToastContainer />);

      expect(screen.getByText('Undo')).toBeInTheDocument();
    });

    it('calls action onClick when clicked', () => {
      const onClick = vi.fn();
      useToastStore.getState().addToast({
        message: 'Actionable',
        type: 'info',
        action: { label: 'Click me', onClick },
      });

      render(<ToastContainer />);

      fireEvent.click(screen.getByText('Click me'));

      expect(onClick).toHaveBeenCalled();
    });

    it('dismisses toast after action click', () => {
      useToastStore.getState().addToast({
        message: 'Dismiss after action',
        type: 'info',
        action: { label: 'Do it', onClick: vi.fn() },
      });

      render(<ToastContainer />);

      fireEvent.click(screen.getByText('Do it'));

      // Wait for exit animation
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Toast should be removed from store
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });
  });

  describe('responsive positioning', () => {
    it('uses bottom positioning on desktop', () => {
      mockUseResponsive.mockReturnValue({ isMobile: false });
      useToastStore.getState().addToast('Desktop toast', 'info');

      render(<ToastContainer />);

      const container = screen.getByRole('region');
      expect(container.className).toContain('bottom-4');
      expect(container.className).toContain('right-4');
    });

    it('uses top positioning on mobile', () => {
      mockUseResponsive.mockReturnValue({ isMobile: true });
      useToastStore.getState().addToast('Mobile toast', 'info');

      render(<ToastContainer />);

      const container = screen.getByRole('region');
      expect(container.className).toContain('top-0');
    });

    it('uses full width on mobile', () => {
      mockUseResponsive.mockReturnValue({ isMobile: true });
      useToastStore.getState().addToast('Mobile full width', 'info');

      render(<ToastContainer />);

      // Check that the toast wrapper has mobile width class
      const container = screen.getByRole('region');
      const toastWrapper = container.querySelector('div > div');
      expect(toastWrapper?.className).toContain('w-full');
    });

    it('uses fixed width on desktop', () => {
      mockUseResponsive.mockReturnValue({ isMobile: false });
      useToastStore.getState().addToast('Desktop fixed width', 'info');

      render(<ToastContainer />);

      const container = screen.getByRole('region');
      const toastWrapper = container.querySelector('div > div');
      expect(toastWrapper?.className).toContain('w-80');
    });
  });

  describe('exit animation', () => {
    it('applies exit animation class when dismissing', async () => {
      useToastStore.getState().addToast('Animating', 'info');

      render(<ToastContainer />);

      const toast = screen.getByRole('alert');
      expect(toast.className).toContain('toast-enter-bottom');

      fireEvent.click(screen.getByLabelText('Dismiss notification'));

      // Check exit class is applied
      expect(toast.className).toContain('toast-exit-bottom');
    });

    it('uses top exit animation on mobile', async () => {
      mockUseResponsive.mockReturnValue({ isMobile: true });
      useToastStore.getState().addToast('Mobile animating', 'info');

      render(<ToastContainer />);

      const toast = screen.getByRole('alert');
      expect(toast.className).toContain('toast-enter-top');

      fireEvent.click(screen.getByLabelText('Dismiss notification'));

      expect(toast.className).toContain('toast-exit-top');
    });
  });

  describe('progress bar', () => {
    it('shows progress bar when duration > 0', () => {
      useToastStore
        .getState()
        .addToast({ message: 'With progress', type: 'info', duration: 5000 });

      render(<ToastContainer />);

      // Progress bar container has bg-black/20
      const toast = screen.getByRole('alert');
      const progressContainer = toast.querySelector('.bg-black\\/20');
      expect(progressContainer).toBeInTheDocument();
    });

    it('hides progress bar when duration is 0', () => {
      useToastStore
        .getState()
        .addToast({ message: 'No progress', type: 'info', duration: 0 });

      render(<ToastContainer />);

      const toast = screen.getByRole('alert');
      const progressContainer = toast.querySelector('.bg-black\\/20');
      expect(progressContainer).not.toBeInTheDocument();
    });
  });
});
