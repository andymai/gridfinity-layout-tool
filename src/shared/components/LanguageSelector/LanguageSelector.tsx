/**
 * Compact language selector for the header.
 *
 * Shows a globe icon with a dropdown of supported locales.
 * Persists selection to settings and updates the app locale.
 */

import { useState, useRef, useEffect } from 'react';
import { Button, cn } from '@/design-system';
import { useLocale, SUPPORTED_LOCALES, useTranslation } from '@/i18n';
import type { Locale } from '@/i18n';
import { useSettingsStore } from '@/core/store';

/** Globe icon component */
function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      />
    </svg>
  );
}

/** Checkmark icon for selected locale */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function LanguageSelector() {
  const t = useTranslation();
  const { locale, setLocale, isLoading } = useLocale();
  const updateSetting = useSettingsStore((state) => state.updateSetting);

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleLocaleSelect = (newLocale: Locale) => {
    updateSetting('locale', newLocale);
    setLocale(newLocale);
    setIsOpen(false);
  };

  // Get current locale display code (uppercase, shortened)
  const displayCode = locale === 'pt-BR' ? 'PT' : locale.toUpperCase();

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-1 px-2 text-sm text-content-secondary hover:text-content"
        title={t('header.changeLanguage')}
        aria-label={t('header.changeLanguage')}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <GlobeIcon className="w-4 h-4" />
        <span className="text-xs font-medium min-w-[1.5rem]">
          {isLoading ? '...' : displayCode}
        </span>
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-1 py-1 bg-surface-elevated border border-stroke-subtle rounded-lg shadow-lg z-50 min-w-[180px]"
          role="listbox"
          aria-label={t('header.selectLanguage')}
        >
          {SUPPORTED_LOCALES.map((loc) => {
            const isSelected = locale === loc.code;
            return (
              <Button
                key={loc.code}
                variant="ghost"
                fullWidth
                onClick={() => handleLocaleSelect(loc.code)}
                className={cn(
                  'justify-between gap-2 rounded-none px-3 py-2 text-sm font-normal',
                  isSelected ? 'bg-accent/10 text-accent' : 'text-content-secondary'
                )}
                role="option"
                aria-selected={isSelected}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-content-tertiary w-6">
                    {/* eslint-disable-next-line i18next/no-literal-string -- locale codes are not translatable */}
                    {loc.code === 'pt-BR' ? 'PT' : loc.code.toUpperCase()}
                  </span>
                  <span>{loc.nativeName}</span>
                </div>
                {isSelected && <CheckIcon className="w-4 h-4 text-accent flex-shrink-0" />}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
