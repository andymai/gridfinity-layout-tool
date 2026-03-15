// === Branded ID Types ===
// Nominal types that prevent accidentally mixing different ID domains.
// Use constructor helpers (binId, layerId, etc.) at system boundaries.

export type BinId = string & { readonly __brand: 'BinId' };
export type LayerId = string & { readonly __brand: 'LayerId' };
export type CategoryId = string & { readonly __brand: 'CategoryId' };
export type LayoutId = string & { readonly __brand: 'LayoutId' };
export type DesignId = string & { readonly __brand: 'DesignId' };

/** Brand a raw string as a BinId. Use at system boundaries (deserialization, user input). */
export const binId = (id: string): BinId => id as BinId;
/** Brand a raw string as a LayerId. Use at system boundaries (deserialization, user input). */
export const layerId = (id: string): LayerId => id as LayerId;
/** Brand a raw string as a CategoryId. Use at system boundaries (deserialization, user input). */
export const categoryId = (id: string): CategoryId => id as CategoryId;
/** Brand a raw string as a LayoutId. Use at system boundaries (deserialization, user input). */
export const layoutId = (id: string): LayoutId => id as LayoutId;
/** Brand a raw string as a DesignId. Use at system boundaries (deserialization, user input). */
export const designId = (id: string): DesignId => id as DesignId;
