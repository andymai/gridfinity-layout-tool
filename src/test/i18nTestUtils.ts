/**
 * Test-only translation helpers.
 *
 * Provides a `t` function backed by the real `en.ts` source-of-truth dictionary,
 * with the same `{var}` interpolation semantics as the runtime context. Use this
 * instead of `vi.fn()`-style stubs so tests assert against actual English text.
 */

import en from '@/i18n/locales/en';
import { interpolate } from '@/i18n/interpolate';
import type { TFunction } from '@/i18n';

export const testT: TFunction = (key, vars) => interpolate(en[key] ?? key, vars);
