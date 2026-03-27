/**
 * Designer Domain Events
 */

import type { BaseDomainEvent } from '../types';

export type DesignerSavedEvent = BaseDomainEvent<'designer.saved', { readonly designId: string }>;

export type DesignerEvent = DesignerSavedEvent;
