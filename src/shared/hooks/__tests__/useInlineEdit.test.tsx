import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInlineEdit } from '../useInlineEdit';

describe('useInlineEdit', () => {
  it('starts with isEditing false', () => {
    const { result } = renderHook(() =>
      useInlineEdit({ initialValue: 'test', onSave: vi.fn() })
    );

    expect(result.current.isEditing).toBe(false);
  });

  it('sets isEditing true when startEditing is called', () => {
    const { result } = renderHook(() =>
      useInlineEdit({ initialValue: 'test', onSave: vi.fn() })
    );

    act(() => {
      result.current.startEditing();
    });

    expect(result.current.isEditing).toBe(true);
    expect(result.current.editingValue).toBe('test');
  });

  it('updates editingValue when handleChange is called', () => {
    const { result } = renderHook(() =>
      useInlineEdit({ initialValue: 'test', onSave: vi.fn() })
    );

    act(() => {
      result.current.startEditing();
    });
    act(() => {
      result.current.handleChange('new value');
    });

    expect(result.current.editingValue).toBe('new value');
  });

  it('calls onSave with trimmed value when handleFinish is called', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ initialValue: 'test', onSave })
    );

    act(() => {
      result.current.startEditing();
    });
    act(() => {
      result.current.handleChange('  new value  ');
    });
    act(() => {
      result.current.handleFinish();
    });

    expect(onSave).toHaveBeenCalledWith('new value');
    expect(result.current.isEditing).toBe(false);
  });

  it('does not call onSave if value unchanged', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ initialValue: 'test', onSave })
    );

    act(() => {
      result.current.startEditing();
    });
    act(() => {
      result.current.handleFinish();
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.isEditing).toBe(false);
  });

  it('does not call onSave if value is only whitespace', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ initialValue: 'test', onSave })
    );

    act(() => {
      result.current.startEditing();
    });
    act(() => {
      result.current.handleChange('   ');
    });
    act(() => {
      result.current.handleFinish();
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('finishes editing on Enter key', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ initialValue: 'test', onSave })
    );

    act(() => {
      result.current.startEditing();
    });
    act(() => {
      result.current.handleChange('new value');
    });
    act(() => {
      result.current.handleKeyDown({ key: 'Enter' } as React.KeyboardEvent);
    });

    expect(onSave).toHaveBeenCalledWith('new value');
    expect(result.current.isEditing).toBe(false);
  });

  it('cancels editing on Escape key without saving', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useInlineEdit({ initialValue: 'test', onSave })
    );

    act(() => {
      result.current.startEditing();
    });
    act(() => {
      result.current.handleChange('new value');
    });
    act(() => {
      result.current.handleKeyDown({ key: 'Escape' } as React.KeyboardEvent);
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.isEditing).toBe(false);
    expect(result.current.editingValue).toBe('test'); // Reset to initial
  });

  it('resets editingValue to initialValue when startEditing is called', () => {
    const { result, rerender } = renderHook(
      ({ initialValue }) => useInlineEdit({ initialValue, onSave: vi.fn() }),
      { initialProps: { initialValue: 'test' } }
    );

    act(() => {
      result.current.startEditing();
    });
    act(() => {
      result.current.handleChange('changed');
    });
    act(() => {
      result.current.handleKeyDown({ key: 'Escape' } as React.KeyboardEvent);
    });

    // Rerender with new initial value
    rerender({ initialValue: 'updated' });

    act(() => {
      result.current.startEditing();
    });

    expect(result.current.editingValue).toBe('updated');
  });
});
