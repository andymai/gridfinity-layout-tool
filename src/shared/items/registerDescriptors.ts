/**
 * Eagerly registers every item-type descriptor. Import this once from any
 * environment that resolves descriptors by kind (designer storage, the kind
 * picker). Importing it has the side effect of populating the descriptor
 * registry — keep it free of React and OCCT.
 */
import { binDescriptor } from '@/shared/items/bin/descriptor';
import { registerItemDescriptor } from '@/shared/items/registry';
import { toolRackDescriptor } from '@/shared/items/toolRack/descriptor';

let registered = false;

export function registerItemDescriptors(): void {
  if (registered) return;
  registered = true;
  registerItemDescriptor(binDescriptor);
  registerItemDescriptor(toolRackDescriptor);
}

registerItemDescriptors();
