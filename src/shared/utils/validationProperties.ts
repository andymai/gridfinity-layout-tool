/**
 * Custom-property validation for bins.
 *
 * Validates user-defined `customProperties: Record<string, string>` against
 * count limits, key/value length caps, and the reserved-key list. Returns
 * a `Result<void, ValidationError>` so the caller can either pass through
 * (`isOk`) or surface the first user-facing error message.
 */

import type { Result, ValidationError } from '@/core/result';
import { ok, err, validationImportFailed } from '@/core/result';
import { CONSTRAINTS, RESERVED_PROPERTY_KEYS } from '@/core/constants';

/**
 * Validate custom properties for a bin.
 * Checks property count, key/value lengths, and reserved keys.
 *
 * @param props - Custom properties object to validate
 * @returns Result with void on success or ValidationError on failure
 */
export function validateCustomProperties(
  props: Record<string, string>
): Result<void, ValidationError> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- props may be null/undefined at runtime
  if (!props) {
    return ok(undefined); // undefined/null is valid (no custom properties)
  }

  if (typeof props !== 'object' || Array.isArray(props)) {
    return err(validationImportFailed(['Custom properties must be provided as a plain object']));
  }

  const keys = Object.keys(props);

  // Check property count
  if (keys.length > CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT) {
    return err(
      validationImportFailed([
        `Maximum ${CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT} custom properties allowed per bin`,
      ])
    );
  }

  // Validate each property
  for (const key of keys) {
    // Check key is not empty
    if (!key.trim()) {
      return err(validationImportFailed(['Custom property key cannot be empty']));
    }

    // Check key length
    if (key.length > CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH) {
      return err(
        validationImportFailed([
          `Custom property key "${key}" exceeds maximum length of ${CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH} characters`,
        ])
      );
    }

    // Check reserved keys
    if (RESERVED_PROPERTY_KEYS.includes(key as (typeof RESERVED_PROPERTY_KEYS)[number])) {
      return err(
        validationImportFailed([
          `"${key}" is a reserved field name and cannot be used as a custom property`,
        ])
      );
    }

    // Check value type
    const value = props[key];
    if (typeof value !== 'string') {
      return err(validationImportFailed([`Custom property value for "${key}" must be a string`]));
    }

    // Check value length
    if (value.length > CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH) {
      return err(
        validationImportFailed([
          `Custom property value for "${key}" exceeds maximum length of ${CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH} characters`,
        ])
      );
    }
  }

  return ok(undefined);
}
