import { describe, expect, it } from 'vitest';
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineSegments,
  Mesh,
  Uint16BufferAttribute,
} from 'three';
import { meshDataFrom } from './sampleMeshes';

function triangle(indexed: boolean): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]), 3)
  );
  if (indexed) geometry.setIndex(new Uint16BufferAttribute([0, 1, 2], 1));
  return geometry;
}

function edgeLines(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 10, 0, 0]), 3));
  return geometry;
}

describe('meshDataFrom', () => {
  it('reads the body and its edge lines into the generator mesh shape', () => {
    const node = new Group();
    node.add(new Mesh(triangle(true)), new LineSegments(edgeLines()));

    const mesh = meshDataFrom(node);

    expect(mesh?.vertices).toEqual(new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]));
    expect(mesh?.indices).toEqual(new Uint32Array([0, 1, 2]));
    expect(mesh?.normals).toHaveLength(9);
    expect(mesh?.edgeVertices).toEqual(new Float32Array([0, 0, 0, 10, 0, 0]));
    expect(mesh?.triangleCount).toBe(1);
  });

  it('numbers the vertices of a body with no index', () => {
    const node = new Group();
    node.add(new Mesh(triangle(false)));

    const mesh = meshDataFrom(node);

    expect(mesh?.indices).toEqual(new Uint32Array([0, 1, 2]));
    expect(mesh?.edgeVertices).toHaveLength(0);
  });

  it('gives nothing for a node with no body', () => {
    const node = new Group();
    node.add(new LineSegments(edgeLines()));
    expect(meshDataFrom(node)).toBeNull();
  });
});
