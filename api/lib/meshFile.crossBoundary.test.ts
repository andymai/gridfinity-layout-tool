/**
 * Cross-boundary tests for the mesh file format.
 *
 * api/ cannot import src/ at runtime, so the server's upload validator is a
 * hand mirror of the client codec. A file the server accepts but the client
 * cannot decode is a stored mesh no design can draw; the reverse is an honest
 * upload the server refuses. Both sides run over the same files here.
 */
import { describe, expect, it } from 'vitest';

import { isOk, unwrap } from '../../src/core/result/index.js';
import {
  MAX_DECODED_MESH_BYTES as CLIENT_MAX_DECODED_MESH_BYTES,
  MAX_MESH_OUTLINE_POINTS,
  encodeMeshData,
} from '../../src/shared/generation/meshAsset.js';
import {
  MAX_MESH_FILE_GEOMETRY_BYTES as CLIENT_MAX_GEOMETRY_BYTES,
  MAX_MESH_FILE_RINGS as CLIENT_MAX_RINGS,
  MAX_MESH_OUTLINE_COORD_MM,
  MESH_FILE_HEADER_BYTES as CLIENT_HEADER_BYTES,
  MESH_FILE_VERSION as CLIENT_VERSION,
  decodeMeshFile,
  encodeMeshFile,
} from '../../src/shared/generation/meshFile.js';
import type { MeshFileContent } from '../../src/shared/generation/meshFile.js';
import { CONSTRAINTS } from './designerValidationConstants.js';
import {
  MAX_DECODED_MESH_BYTES,
  MAX_MESH_FILE_GEOMETRY_BYTES,
  MAX_MESH_FILE_RINGS,
  MAX_MESH_UPLOAD_BYTES,
  MESH_FILE_HEADER_BYTES,
  MESH_FILE_VERSION,
  meshFileHash,
  validateMeshFile,
} from './meshFile.js';

async function asset(triangleCount = 4): Promise<MeshFileContent> {
  const positions = new Float32Array([0, 0, 0, 40, 0, 0, 0, 40, 0, 0, 0, 40]);
  const indices = new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]);
  return {
    data: unwrap(await encodeMeshData(positions, indices)),
    triangleCount,
    outlines: [
      [
        { x: 0, y: 0 },
        { x: 40.25, y: 0 },
        { x: 40.25, y: 39.5 },
      ],
      [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 },
      ],
    ],
  };
}

function withU32(bytes: Uint8Array, offset: number, value: number): Uint8Array {
  const copy = bytes.slice();
  new DataView(copy.buffer).setUint32(offset, value, true);
  return copy;
}

function withLastF64(bytes: Uint8Array, value: number): Uint8Array {
  const copy = bytes.slice();
  new DataView(copy.buffer).setFloat64(copy.byteLength - 8, value, true);
  return copy;
}

/** Deterministic PRNG so a parity failure reproduces. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function verdicts(bytes: Uint8Array): Promise<{ client: boolean; server: boolean }> {
  const [client, server] = await Promise.all([decodeMeshFile(bytes), validateMeshFile(bytes)]);
  return { client: isOk(client), server: server.ok };
}

describe('mesh file mirrors', () => {
  it.each([
    ['MESH_FILE_VERSION', MESH_FILE_VERSION, CLIENT_VERSION],
    ['MESH_FILE_HEADER_BYTES', MESH_FILE_HEADER_BYTES, CLIENT_HEADER_BYTES],
    ['MAX_MESH_FILE_GEOMETRY_BYTES', MAX_MESH_FILE_GEOMETRY_BYTES, CLIENT_MAX_GEOMETRY_BYTES],
    ['MAX_MESH_FILE_RINGS', MAX_MESH_FILE_RINGS, CLIENT_MAX_RINGS],
    ['MAX_MESH_SIZE_MM', CONSTRAINTS.MAX_MESH_SIZE_MM, MAX_MESH_OUTLINE_COORD_MM],
    ['MAX_DECODED_MESH_BYTES', MAX_DECODED_MESH_BYTES, CLIENT_MAX_DECODED_MESH_BYTES],
  ])('%s matches the client', (_label, server, client) => {
    expect(server).toBe(client);
  });

  it('caps uploads above the largest file the layout admits', () => {
    const largest =
      MESH_FILE_HEADER_BYTES +
      MAX_MESH_FILE_RINGS * 4 +
      MAX_MESH_FILE_GEOMETRY_BYTES +
      MAX_MESH_OUTLINE_POINTS * 16;
    expect(largest).toBeLessThan(MAX_MESH_UPLOAD_BYTES);
  });

  it('names a file by the same SHA-256 the browser computes', async () => {
    const file = unwrap(encodeMeshFile(await asset()));
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', file.slice()));
    const webHex = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
    expect(meshFileHash(file)).toBe(webHex);
  });
});

describe('client and server agree on every file', () => {
  it('both accept what the client encodes', async () => {
    expect(await verdicts(unwrap(encodeMeshFile(await asset())))).toEqual({
      client: true,
      server: true,
    });
  });

  it('agree on each malformed file', async () => {
    const valid = unwrap(encodeMeshFile(await asset()));
    const padded = new Uint8Array(valid.byteLength + 1);
    padded.set(valid);
    const corpus: Record<string, Uint8Array> = {
      truncatedHeader: valid.subarray(0, 10),
      badMagic: withU32(valid, 0, 0),
      badVersion: withU32(valid, 4, 9),
      zeroTriangles: withU32(valid, 8, 0),
      overTriangleBudget: withU32(valid, 8, CONSTRAINTS.MAX_MESH_ASSET_TRIANGLES + 1),
      declaredCountLie: unwrap(encodeMeshFile(await asset(3))),
      overGeometryCap: withU32(valid, 12, MAX_MESH_FILE_GEOMETRY_BYTES + 1),
      noRings: withU32(valid, 16, 0),
      ringUnderThree: withU32(valid, MESH_FILE_HEADER_BYTES, 2),
      overPointBudget: withU32(valid, MESH_FILE_HEADER_BYTES, MAX_MESH_OUTLINE_POINTS),
      trailingByte: padded,
      missingByte: valid.subarray(0, valid.byteLength - 1),
      nanPoint: withLastF64(valid, Number.NaN),
      farPoint: withLastF64(valid, 5000),
      negativeZeroPoint: withLastF64(valid, -0),
    };
    for (const [name, bytes] of Object.entries(corpus)) {
      expect({ name, ...(await verdicts(bytes)) }).toEqual({
        name,
        client: false,
        server: false,
      });
    }
  });

  it('agree on randomly corrupted files', async () => {
    const valid = unwrap(encodeMeshFile(await asset()));
    const random = mulberry32(0x6d657368);
    const seen = { accepted: 0, rejected: 0 };
    for (let trial = 0; trial < 300; trial++) {
      const bytes = valid.slice();
      const flips = 1 + Math.floor(random() * 3);
      for (let f = 0; f < flips; f++) {
        bytes[Math.floor(random() * bytes.byteLength)] = Math.floor(random() * 256);
      }
      const { client, server } = await verdicts(bytes);
      expect({ trial, server }).toEqual({ trial, server: client });
      seen[client ? 'accepted' : 'rejected']++;
    }
    expect(seen.accepted).toBeGreaterThan(0);
    expect(seen.rejected).toBeGreaterThan(0);
  });
});
