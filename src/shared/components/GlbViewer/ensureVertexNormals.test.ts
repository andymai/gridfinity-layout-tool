import { describe, expect, it } from 'vitest';
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { ensureVertexNormals } from './ensureVertexNormals';

function triangleGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3)
  );
  return geometry;
}

describe('ensureVertexNormals', () => {
  it('computes normals for a mesh that has none', () => {
    const mesh = new Mesh(triangleGeometry(), new MeshStandardMaterial());
    expect(mesh.geometry.hasAttribute('normal')).toBe(false);

    ensureVertexNormals(mesh);

    const normal = mesh.geometry.getAttribute('normal');
    expect(normal.count).toBe(3);
    // A triangle in the XY plane faces +Z; every corner of a non-indexed face
    // gets that same normal.
    expect(normal.getZ(0)).toBeCloseTo(1);
    expect(Number.isNaN(normal.getX(0))).toBe(false);
  });

  it('takes the material off flat shading so the computed normals are used', () => {
    const material = new MeshStandardMaterial({ flatShading: true });
    const mesh = new Mesh(triangleGeometry(), material);
    const version = material.version;

    ensureVertexNormals(mesh);

    expect(material.flatShading).toBe(false);
    // `needsUpdate` is write-only on Material — it bumps `version`, which is
    // what actually forces the shader to recompile.
    expect(material.version).toBeGreaterThan(version);
  });

  it('clears flat shading on every material of a multi-material mesh', () => {
    const materials = [
      new MeshStandardMaterial({ flatShading: true }),
      new MeshStandardMaterial({ flatShading: true }),
    ];
    const mesh = new Mesh(triangleGeometry(), materials);

    ensureVertexNormals(mesh);

    expect(materials.map((m) => m.flatShading)).toEqual([false, false]);
  });

  it('leaves a mesh that already carries normals untouched', () => {
    const geometry = triangleGeometry();
    const authored = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    geometry.setAttribute('normal', new BufferAttribute(authored, 3));
    const material = new MeshStandardMaterial({ flatShading: true });
    const mesh = new Mesh(geometry, material);

    ensureVertexNormals(mesh);

    expect(geometry.getAttribute('normal').array).toBe(authored);
    // Untouched means untouched: an authored normal set is the artist's flat
    // shading choice, not the NaN-producing absence this repairs.
    expect(material.flatShading).toBe(true);
  });

  it('repairs meshes nested under a group and ignores non-meshes', () => {
    const group = new Group();
    const mesh = new Mesh(triangleGeometry(), new MeshStandardMaterial());
    const lines = new LineSegments(triangleGeometry(), new LineBasicMaterial());
    group.add(mesh, lines);

    expect(() => ensureVertexNormals(group)).not.toThrow();

    expect(mesh.geometry.hasAttribute('normal')).toBe(true);
    expect(lines.geometry.hasAttribute('normal')).toBe(false);
  });

  it('is idempotent across repeated mounts of a cached scene', () => {
    const mesh = new Mesh(triangleGeometry(), new MeshStandardMaterial());

    ensureVertexNormals(mesh);
    const first = mesh.geometry.getAttribute('normal').array;
    ensureVertexNormals(mesh);

    expect(mesh.geometry.getAttribute('normal').array).toBe(first);
  });
});
