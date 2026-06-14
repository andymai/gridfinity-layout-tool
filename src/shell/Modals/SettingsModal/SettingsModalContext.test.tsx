import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SettingsNavProvider, useSettingsNav } from './SettingsModalContext';

describe('useSettingsNav', () => {
  it('returns a no-op fallback outside a provider', () => {
    const { result } = renderHook(() => useSettingsNav());
    expect(result.current.highlightedSectionId).toBeNull();
    // Should not throw.
    expect(() => result.current.navigateToSection('general', 'language')).not.toThrow();
  });

  it('returns the provided value inside a provider', () => {
    const navigateToSection = () => {};
    const { result } = renderHook(() => useSettingsNav(), {
      wrapper: ({ children }) => (
        <SettingsNavProvider value={{ navigateToSection, highlightedSectionId: 'theme' }}>
          {children}
        </SettingsNavProvider>
      ),
    });
    expect(result.current.highlightedSectionId).toBe('theme');
    expect(result.current.navigateToSection).toBe(navigateToSection);
  });
});
