/**
 * Item-type descriptor registry — the schema half of the item-type system.
 *
 * A descriptor bundles everything that is worker-, UI-, AND storage-safe (no
 * React, no OCCT): structure schema, defaults, migration, display i18n keys,
 * and the default export filename. The two halves that cannot live here —
 * the OCCT generator and the React panel — register in their own feature
 * registries (`generation/worker/items`, `bin-designer/items`) and look up
 * their metadata here by `ItemKind`.
 */
import type { z } from 'zod';
import type { ItemEnvelope, ItemKind, ItemStructure } from '@/shared/types/item';

export interface ItemTypeDescriptor<S extends ItemStructure = ItemStructure> {
  readonly kind: S['kind'];
  /** Validates the kind-specific structure payload. */
  readonly schema: z.ZodType<S>;
  /** Fresh defaults object on every call. */
  readonly defaults: () => S;
  /** Coerce persisted/partial data into a valid structure. */
  readonly migrate: (raw: unknown, envelope: ItemEnvelope) => S;
  /** i18n key for the kind's display name. */
  readonly labelKey: string;
  /** i18n key for the kind's one-line description. */
  readonly descriptionKey: string;
  /** Default export filename stem (no extension). */
  readonly exportFileName: (envelope: ItemEnvelope, structure: S) => string;
}

const descriptors = new Map<ItemKind, ItemTypeDescriptor>();

export function registerItemDescriptor<S extends ItemStructure>(
  descriptor: ItemTypeDescriptor<S>
): void {
  descriptors.set(descriptor.kind, descriptor as unknown as ItemTypeDescriptor);
}

export function getItemDescriptor(kind: ItemKind): ItemTypeDescriptor {
  const descriptor = descriptors.get(kind);
  if (!descriptor) {
    throw new Error(`No item descriptor registered for kind '${kind}'`);
  }
  return descriptor;
}

export function hasItemDescriptor(kind: ItemKind): boolean {
  return descriptors.has(kind);
}

export function listItemDescriptors(): readonly ItemTypeDescriptor[] {
  return [...descriptors.values()];
}
