import type { Bin, BinId, Layer, LayerId, Category, CategoryId } from '@/core/types';
import type { Result, LayoutError, ValidationError, ValidationFailureReason } from '@/core/result';
import {
  ok,
  err,
  layoutInvalidOperation,
  validationOutOfBounds,
  validationCollision,
} from '@/core/result';

export function findBin(bins: Bin[], id: BinId): Bin | undefined {
  return bins.find((b) => b.id === id);
}

export function requireBin(bins: Bin[], id: BinId, op: string): Result<Bin, LayoutError> {
  const bin = findBin(bins, id);
  if (!bin) return err(layoutInvalidOperation(op, `Bin ${id} not found`));
  return ok(bin);
}

export function requireLayer(layers: Layer[], id: LayerId, op: string): Result<Layer, LayoutError> {
  const layer = layers.find((l) => l.id === id);
  if (!layer) return err(layoutInvalidOperation(op, `Layer ${id} not found`));
  return ok(layer);
}

export function requireCategory(
  categories: Category[],
  id: CategoryId,
  op: string
): Result<Category, LayoutError> {
  const category = categories.find((c) => c.id === id);
  if (!category) return err(layoutInvalidOperation(op, `Category ${id} not found`));
  return ok(category);
}

export function toPlacementError(
  reason: ValidationFailureReason,
  rect: { x: number; y: number; width: number; depth: number }
): ValidationError {
  if (reason === 'collision') return validationCollision();
  return validationOutOfBounds(reason, rect);
}
