import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Import actual translations for testing
import common from '../i18n/locales/en/common.json'
import layout from '../i18n/locales/en/layout.json'
import validation from '../i18n/locales/en/validation.json'
import toast from '../i18n/locales/en/toast.json'
import share from '../i18n/locales/en/share.json'
import print from '../i18n/locales/en/print.json'
import help from '../i18n/locales/en/help.json'
import aria from '../i18n/locales/en/aria.json'

const translations: Record<string, Record<string, unknown>> = {
  common,
  layout,
  validation,
  toast,
  share,
  print,
  help,
  aria,
}

// Get a nested value from an object using dot notation
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return typeof current === 'string' ? current : undefined
}

// Mock react-i18next to return actual translations
vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string | string[]) => ({
    t: (key: string, params?: Record<string, unknown>) => {
      // Determine namespace and key
      let namespace = 'common'
      let lookupKey = key

      if (key.includes(':')) {
        const [nsFromKey, k] = key.split(':')
        namespace = nsFromKey
        lookupKey = k
      } else if (typeof ns === 'string') {
        namespace = ns
      } else if (Array.isArray(ns) && ns.length > 0) {
        namespace = ns[0]
      }

      // Look up translation
      const nsTranslations = translations[namespace]
      if (!nsTranslations) return key

      let value: string | undefined

      // Handle pluralization (simplified) - check FIRST before base lookup
      if (params?.count !== undefined) {
        const count = Number(params.count)
        if (count !== 1) {
          value = getNestedValue(nsTranslations, `${lookupKey}_other`)
        }
        // Fall back to base key if plural form not found
        if (!value) {
          value = getNestedValue(nsTranslations, lookupKey)
        }
      } else {
        value = getNestedValue(nsTranslations, lookupKey)
      }

      if (!value) return key

      // Interpolate params
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
        }
      }

      return value
    },
    i18n: {
      language: 'en',
      changeLanguage: () => Promise.resolve(),
    },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

// Mock pointer capture methods not implemented in jsdom
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.hasPointerCapture = () => false

// Mock matchMedia for responsive hook tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
