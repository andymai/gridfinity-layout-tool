import { describe, expect, it } from 'vitest';
import { getItemGenerator, registerItemGenerator } from './generatorRegistry';
import type { ItemGeneratorModule } from './generatorRegistry';

const fake: ItemGeneratorModule = {
  kind: 'toolRack',
  generate: () => ({
    vertices: new Float32Array(),
    normals: new Float32Array(),
    indices: new Uint32Array(),
    edgeVertices: new Float32Array(),
    triangleCount: 0,
  }),
  export: async () => ({ data: new ArrayBuffer(0), fileName: 'x.stl' }),
};

describe('generator registry', () => {
  it('registers and retrieves a generator by kind', () => {
    registerItemGenerator(fake);
    expect(getItemGenerator('toolRack')).toBe(fake);
  });

  it('throws on an unregistered kind', () => {
    expect(() => getItemGenerator('nope' as never)).toThrow(/No item generator/);
  });
});
