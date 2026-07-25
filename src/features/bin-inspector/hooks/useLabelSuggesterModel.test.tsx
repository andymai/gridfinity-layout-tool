import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLabelSuggesterModel } from './useLabelSuggesterModel';

describe('useLabelSuggesterModel', () => {
  it('starts null and resolves to the loaded model', async () => {
    const { result } = renderHook(() => useLabelSuggesterModel());
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.schemaVersion).toBe(1);
  });
});
