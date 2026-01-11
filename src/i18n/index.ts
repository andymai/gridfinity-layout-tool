import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all English translations
import common from './locales/en/common.json';
import layout from './locales/en/layout.json';
import validation from './locales/en/validation.json';
import toast from './locales/en/toast.json';
import share from './locales/en/share.json';
import print from './locales/en/print.json';
import help from './locales/en/help.json';
import aria from './locales/en/aria.json';

export const defaultNS = 'common';
export const namespaces = [
  'common',
  'layout',
  'validation',
  'toast',
  'share',
  'print',
  'help',
  'aria',
] as const;

export type Namespace = (typeof namespaces)[number];

export const resources = {
  en: {
    common,
    layout,
    validation,
    toast,
    share,
    print,
    help,
    aria,
  },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS,
    ns: namespaces,
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'gridfinity-language',
    },
  })
  .catch((error) => {
    console.error('Failed to initialize i18n:', error);
  });

export default i18n;
