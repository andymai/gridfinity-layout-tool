import type common from './locales/en/common.json';
import type layout from './locales/en/layout.json';
import type validation from './locales/en/validation.json';
import type toast from './locales/en/toast.json';
import type share from './locales/en/share.json';
import type print from './locales/en/print.json';
import type help from './locales/en/help.json';
import type aria from './locales/en/aria.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      layout: typeof layout;
      validation: typeof validation;
      toast: typeof toast;
      share: typeof share;
      print: typeof print;
      help: typeof help;
      aria: typeof aria;
    };
  }
}
