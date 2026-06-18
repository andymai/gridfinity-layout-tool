/**
 * Registers every item generator. Imported once at the top of
 * `generation.worker.ts` so the generator registry is populated before any
 * GENERATE_ITEM / EXPORT_ITEM message arrives. Worker-only — pulls OCCT, never React.
 */
import { binGeneratorModule } from './binItem';
import { registerItemGenerator } from './generatorRegistry';
import { toolRackGeneratorModule } from './toolRackItem';

registerItemGenerator(binGeneratorModule);
registerItemGenerator(toolRackGeneratorModule);
