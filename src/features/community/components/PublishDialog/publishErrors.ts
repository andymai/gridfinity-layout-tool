/**
 * Turns a publish failure into where it should appear, not just what it says.
 *
 * The server rejects on fields it names (`NAME_TOO_SHORT`, `NAME_LOW_EFFORT`,
 * `INVALID_CATEGORY`), and burying those in a dialog-level banner makes the
 * user hunt for which input is at fault. Anything the server attributes to a
 * field is routed to that field; everything else is a banner.
 */

import type { CommunityClientError } from '../../api/client';

export type PublishErrorField = 'name' | 'description' | 'category' | 'publicName';

export interface PublishErrorPresentation {
  /** Input to attach the message to; null renders it as a banner above the form. */
  field: PublishErrorField | null;
  messageKey: string;
  values?: Record<string, string | number>;
  /** Banner offers re-submitting the same fields unchanged. */
  retryable: boolean;
  /** Banner offers the sign-in providers. */
  needsAuth: boolean;
  /** Banner offers publishing with the remix link dropped. */
  canDropRemix: boolean;
}

interface ValidationPresentation {
  field: PublishErrorField | null;
  messageKey: string;
  retryable?: boolean;
  canDropRemix?: boolean;
}

/**
 * Server messages are English-only, so known codes map to i18n keys. An
 * unmapped code falls back to the generic banner rather than leaking English.
 */
const VALIDATION_PRESENTATION: Partial<Record<string, ValidationPresentation>> = {
  INVALID_NAME: { field: 'name', messageKey: 'community.publish.error.invalidName' },
  NAME_TOO_SHORT: { field: 'name', messageKey: 'community.publish.error.nameTooShort' },
  NAME_PLACEHOLDER: { field: 'name', messageKey: 'community.publish.error.namePlaceholder' },
  NAME_LOW_EFFORT: { field: 'name', messageKey: 'community.publish.error.nameLowEffort' },
  DUPLICATE_DESIGN: { field: 'name', messageKey: 'community.publish.error.duplicate' },
  INVALID_DESCRIPTION: {
    field: 'description',
    messageKey: 'community.publish.error.invalidDescription',
  },
  INVALID_CATEGORY: { field: 'category', messageKey: 'community.publish.error.invalidCategory' },
  INVALID_AUTHOR_NAME: {
    field: 'publicName',
    messageKey: 'community.publish.error.invalidAuthorName',
  },
  DESCRIPTION_REQUIRED: {
    field: 'description',
    messageKey: 'community.publish.error.descriptionRequired',
  },
  DESCRIPTION_TOO_SHORT: {
    field: 'description',
    messageKey: 'community.publish.error.descriptionTooShort',
  },
  DESCRIPTION_LOW_EFFORT: {
    field: 'description',
    messageKey: 'community.publish.error.descriptionLowEffort',
  },
  REMIX_UNCHANGED: { field: null, messageKey: 'community.publish.error.remixUnchanged' },
  INVALID_LINEAGE: {
    field: null,
    messageKey: 'community.publish.error.invalidLineage',
    canDropRemix: true,
  },
  UNDER_REVIEW: { field: null, messageKey: 'community.publish.error.underReview' },
  PUBLISH_IN_PROGRESS: {
    field: null,
    messageKey: 'community.publish.error.inProgress',
    retryable: true,
  },
};

const BASE: PublishErrorPresentation = {
  field: null,
  messageKey: 'community.publish.error.generic',
  retryable: false,
  needsAuth: false,
  canDropRemix: false,
};

export function presentPublishError(error: CommunityClientError): PublishErrorPresentation {
  switch (error.kind) {
    case 'needsAuth':
      return { ...BASE, messageKey: 'community.publish.error.needsAuth', needsAuth: true };
    case 'disabled':
      return { ...BASE, messageKey: 'community.publish.error.disabled' };
    case 'rateLimited':
      return error.retryAfterSeconds !== null
        ? {
            ...BASE,
            messageKey: 'community.publish.error.rateLimitedWait',
            values: { seconds: error.retryAfterSeconds },
          }
        : { ...BASE, messageKey: 'community.publish.error.rateLimited' };
    case 'quotaExceeded':
      return { ...BASE, messageKey: 'community.publish.error.quota' };
    case 'contentBlocked':
      // The filter does not say which field tripped it, and guessing would
      // point the user at the wrong input.
      return { ...BASE, messageKey: 'community.publish.error.contentBlocked' };
    case 'validation': {
      const mapped = VALIDATION_PRESENTATION[error.code];
      if (mapped === undefined) return BASE;
      return {
        ...BASE,
        field: mapped.field,
        messageKey: mapped.messageKey,
        retryable: mapped.retryable ?? false,
        canDropRemix: mapped.canDropRemix ?? false,
      };
    }
    case 'forbidden':
      return BASE;
    case 'notFound':
      return { ...BASE, messageKey: 'community.publish.error.notFound' };
    case 'network':
      return { ...BASE, messageKey: 'community.publish.error.offline', retryable: true };
    case 'server':
      return { ...BASE, retryable: true };
  }
}
