import { describe, it, expect } from 'vitest';
import { validateCustomProperties } from './validationProperties';
import { isOk, isErr } from '@/core/result';
import { CONSTRAINTS, RESERVED_PROPERTY_KEYS } from '@/core/constants';

describe('validateCustomProperties', () => {
  describe('ok paths', () => {
    it('returns ok for undefined (treated as no custom properties)', () => {
      const result = validateCustomProperties(undefined as unknown as Record<string, string>);
      expect(isOk(result)).toBe(true);
    });

    it('returns ok for null', () => {
      const result = validateCustomProperties(null as unknown as Record<string, string>);
      expect(isOk(result)).toBe(true);
    });

    it('returns ok for an empty object', () => {
      expect(isOk(validateCustomProperties({}))).toBe(true);
    });

    it('returns ok for valid key/value pairs', () => {
      const result = validateCustomProperties({ SKU: 'ABC123', Qty: '5', Location: 'Shelf A' });
      expect(isOk(result)).toBe(true);
    });

    it('returns ok at exactly CUSTOM_PROPERTY_MAX_COUNT entries', () => {
      const props: Record<string, string> = {};
      for (let i = 0; i < CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT; i++) {
        props[`key${i}`] = 'v';
      }
      expect(isOk(validateCustomProperties(props))).toBe(true);
    });

    it('returns ok for a key at exactly CUSTOM_PROPERTY_KEY_MAX_LENGTH', () => {
      const key = 'a'.repeat(CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH);
      expect(isOk(validateCustomProperties({ [key]: 'value' }))).toBe(true);
    });

    it('returns ok for a value at exactly CUSTOM_PROPERTY_VALUE_MAX_LENGTH', () => {
      const value = 'a'.repeat(CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH);
      expect(isOk(validateCustomProperties({ key: value }))).toBe(true);
    });
  });

  describe('err paths — input shape', () => {
    it('returns err for an array input', () => {
      const result = validateCustomProperties(['value1', 'value2'] as unknown as Record<
        string,
        string
      >);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('VALIDATION_IMPORT_FAILED');
        if (result.error.code === 'VALIDATION_IMPORT_FAILED') {
          expect(result.error.errors[0]).toContain('plain object');
        }
      }
    });

    it('returns err for a string input', () => {
      const result = validateCustomProperties('not-an-object' as unknown as Record<string, string>);
      expect(isErr(result)).toBe(true);
      if (isErr(result) && result.error.code === 'VALIDATION_IMPORT_FAILED') {
        expect(result.error.errors[0]).toContain('plain object');
      }
    });
  });

  describe('err paths — property count', () => {
    it('returns err when count exceeds CUSTOM_PROPERTY_MAX_COUNT', () => {
      const props: Record<string, string> = {};
      for (let i = 0; i <= CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT; i++) {
        props[`key${i}`] = 'v';
      }
      const result = validateCustomProperties(props);
      expect(isErr(result)).toBe(true);
      if (isErr(result) && result.error.code === 'VALIDATION_IMPORT_FAILED') {
        expect(result.error.errors[0]).toContain(`${CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT}`);
        expect(result.error.errors[0]).toContain('custom properties');
      }
    });
  });

  describe('err paths — key validation', () => {
    it('returns err for an empty key', () => {
      const result = validateCustomProperties({ '': 'value' });
      expect(isErr(result)).toBe(true);
      if (isErr(result) && result.error.code === 'VALIDATION_IMPORT_FAILED') {
        expect(result.error.errors[0]).toContain('empty');
      }
    });

    it('returns err for a whitespace-only key', () => {
      const result = validateCustomProperties({ '   ': 'value' });
      expect(isErr(result)).toBe(true);
      if (isErr(result) && result.error.code === 'VALIDATION_IMPORT_FAILED') {
        expect(result.error.errors[0]).toContain('empty');
      }
    });

    it('returns err for a key exceeding CUSTOM_PROPERTY_KEY_MAX_LENGTH', () => {
      const longKey = 'a'.repeat(CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH + 1);
      const result = validateCustomProperties({ [longKey]: 'value' });
      expect(isErr(result)).toBe(true);
      if (isErr(result) && result.error.code === 'VALIDATION_IMPORT_FAILED') {
        expect(result.error.errors[0]).toContain('exceeds maximum length');
        expect(result.error.errors[0]).toContain(`${CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH}`);
      }
    });
  });

  describe('err paths — reserved keys', () => {
    it('returns err for the "id" reserved key', () => {
      const result = validateCustomProperties({ id: 'bin-1' });
      expect(isErr(result)).toBe(true);
      if (isErr(result) && result.error.code === 'VALIDATION_IMPORT_FAILED') {
        expect(result.error.errors[0]).toContain('reserved');
      }
    });

    it('returns err for the "label" reserved key', () => {
      const result = validateCustomProperties({ label: 'My Bin' });
      expect(isErr(result)).toBe(true);
      if (isErr(result) && result.error.code === 'VALIDATION_IMPORT_FAILED') {
        expect(result.error.errors[0]).toContain('reserved');
      }
    });

    it('returns err for the "__proto__" reserved key (prototype pollution guard)', () => {
      // Use computed property syntax — { __proto__: v } is the special prototype-setting form
      // and does NOT create an own property. { ['__proto__']: v } creates an own property.
      const result = validateCustomProperties({ ['__proto__']: '{}' });
      expect(isErr(result)).toBe(true);
      if (isErr(result) && result.error.code === 'VALIDATION_IMPORT_FAILED') {
        expect(result.error.errors[0]).toContain('reserved');
      }
    });

    it('returns err for every key in RESERVED_PROPERTY_KEYS', () => {
      for (const key of RESERVED_PROPERTY_KEYS) {
        const result = validateCustomProperties({ [key]: 'value' });
        expect(isErr(result)).toBe(true);
      }
    });
  });

  describe('err paths — value validation', () => {
    it('returns err when a value is not a string', () => {
      const result = validateCustomProperties({ key: 42 as unknown as string });
      expect(isErr(result)).toBe(true);
      if (isErr(result) && result.error.code === 'VALIDATION_IMPORT_FAILED') {
        expect(result.error.errors[0]).toContain('must be a string');
      }
    });

    it('returns err when a value exceeds CUSTOM_PROPERTY_VALUE_MAX_LENGTH', () => {
      const longValue = 'a'.repeat(CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH + 1);
      const result = validateCustomProperties({ key: longValue });
      expect(isErr(result)).toBe(true);
      if (isErr(result) && result.error.code === 'VALIDATION_IMPORT_FAILED') {
        expect(result.error.errors[0]).toContain('exceeds maximum length');
        expect(result.error.errors[0]).toContain(`${CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH}`);
      }
    });
  });

  describe('error shape', () => {
    it('error has kind "ValidationError" and code "VALIDATION_IMPORT_FAILED"', () => {
      const result = validateCustomProperties({ id: 'will-fail' });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe('ValidationError');
        expect(result.error.code).toBe('VALIDATION_IMPORT_FAILED');
      }
    });

    it('error.errors array contains the failure message', () => {
      const result = validateCustomProperties({ '': 'value' });
      if (isErr(result) && result.error.code === 'VALIDATION_IMPORT_FAILED') {
        expect(result.error.errors).toHaveLength(1);
        expect(typeof result.error.errors[0]).toBe('string');
      }
    });
  });
});
