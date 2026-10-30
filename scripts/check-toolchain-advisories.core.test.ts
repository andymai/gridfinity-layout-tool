import { describe, expect, it } from 'vitest';
import {
  dockerHubRepository,
  fixedVersions,
  githubAnnotation,
  nodeCoreAdvisories,
  osvEcosystem,
  parseApkInstalled,
  parseDpkgStatus,
  partitionByUpstreamFix,
  readTarFiles,
  readToolchainPins,
  satisfiesNodeRange,
} from './check-toolchain-advisories.core.js';

const DIGEST = `sha256:${'a'.repeat(64)}`;
const SHA = 'b'.repeat(40);

function tarHeader(name: string, size: number, type: string): Uint8Array {
  const header = new Uint8Array(512);
  const enc = new TextEncoder();
  header.set(enc.encode(name.slice(0, 100)), 0);
  header.set(enc.encode(size.toString(8).padStart(11, '0')), 124);
  header.set(enc.encode(type), 156);
  header.set(enc.encode('ustar\u000000'), 257);
  return header;
}

function tar(entries: { name: string; body: string; type?: string }[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  for (const e of entries) {
    const body = new TextEncoder().encode(e.body);
    chunks.push(tarHeader(e.name, body.length, e.type ?? '0'));
    const padded = new Uint8Array(Math.ceil(body.length / 512) * 512);
    padded.set(body);
    chunks.push(padded);
  }
  chunks.push(new Uint8Array(1024));
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

describe('readToolchainPins', () => {
  const dockerfile = [
    '# syntax=docker/dockerfile:1',
    `FROM --platform=$BUILDPLATFORM node:26-bookworm-slim@${DIGEST} AS build`,
    'RUN npm install -g corepack@0.36.0 && corepack enable',
    '# corepack@9.9.9 in a comment is not a pin',
    `FROM nginxinc/nginx-unprivileged:1.31.7-alpine-slim@${DIGEST}`,
    'FROM build AS unpinned',
  ].join('\n');

  const pins = readToolchainPins({
    packageJson: '{\n  "name": "x",\n  "packageManager": "pnpm@11.28.8+sha512.abc"\n}',
    dockerfile,
    workflows: [
      {
        path: '.github/workflows/ci.yml',
        text: [
          `      - uses: actions/checkout@${SHA} # v7.0.1`,
          `      - uses: actions/checkout@${SHA} # v7.0.1`,
          `    uses: google/osv-scanner-action/.github/workflows/scan.yml@${SHA} # v2.7.0`,
          '      - uses: ./.github/actions/setup-pnpm',
          '      - uses: actions/cache@v4',
        ].join('\n'),
      },
    ],
  });

  it('reads pnpm from packageManager without its hash suffix', () => {
    expect(pins.packages).toContainEqual({
      ecosystem: 'npm',
      name: 'pnpm',
      version: '11.28.8',
      source: { file: 'package.json', line: 3 },
    });
  });

  it('reads corepack only from a RUN line', () => {
    const corepack = pins.packages.filter((p) => p.name === 'corepack');
    expect(corepack).toEqual([
      {
        ecosystem: 'npm',
        name: 'corepack',
        version: '0.36.0',
        source: { file: 'Dockerfile', line: 3 },
      },
    ]);
  });

  it('reads digest-pinned FROM lines and maps official images to library/', () => {
    expect(pins.images).toEqual([
      {
        repository: 'library/node',
        tag: '26-bookworm-slim',
        digest: DIGEST,
        source: { file: 'Dockerfile', line: 2 },
      },
      {
        repository: 'nginxinc/nginx-unprivileged',
        tag: '1.31.7-alpine-slim',
        digest: DIGEST,
        source: { file: 'Dockerfile', line: 5 },
      },
    ]);
  });

  it('reads SHA-pinned actions by owner/repo, once per version, skipping local and tag refs', () => {
    const actions = pins.packages.filter((p) => p.ecosystem === 'GitHub Actions');
    expect(actions.map((a) => `${a.name}@${a.version}`)).toEqual([
      'actions/checkout@7.0.1',
      'google/osv-scanner-action@2.7.0',
    ]);
  });
});

describe('dockerHubRepository', () => {
  it('rejects images from other registries instead of skipping them', () => {
    expect(() => dockerHubRepository('ghcr.io/owner/image')).toThrow(/Unsupported registry/);
  });
});

describe('parseDpkgStatus', () => {
  it('reports installed packages under their source name and version', () => {
    const status = [
      'Package: libc6',
      'Status: install ok installed',
      'Source: glibc',
      'Version: 2.36-9+deb12u14',
      '',
      'Package: libgnutls30',
      'Status: install ok installed',
      'Source: gnutls28 (3.7.9-2+deb12u7)',
      'Version: 3.7.9-2+deb12u7b1',
      'Description: GNU TLS library',
      ' .',
      ' continuation line',
      '',
      'Package: bash',
      'Status: install ok installed',
      'Version: 5.2.15-2+b9',
      '',
      'Package: removed-thing',
      'Status: deinstall ok config-files',
      'Version: 1.0',
    ].join('\n');
    expect(parseDpkgStatus(status)).toEqual([
      { name: 'glibc', version: '2.36-9+deb12u14' },
      { name: 'gnutls28', version: '3.7.9-2+deb12u7' },
      { name: 'bash', version: '5.2.15-2+b9' },
    ]);
  });
});

describe('parseApkInstalled', () => {
  it('reports packages under their origin and dedupes subpackages', () => {
    const db = [
      'P:zlib',
      'V:1.3.2-r0',
      'o:zlib',
      '',
      'P:libssl3',
      'V:3.5.4-r0',
      'o:openssl',
      '',
      'P:libcrypto3',
      'V:3.5.4-r0',
      'o:openssl',
    ].join('\n');
    expect(parseApkInstalled(db)).toEqual([
      { name: 'zlib', version: '1.3.2-r0' },
      { name: 'openssl', version: '3.5.4-r0' },
    ]);
  });
});

describe('osvEcosystem', () => {
  it('maps os-release to the OSV ecosystem name', () => {
    expect(
      osvEcosystem('PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\nID=debian\nVERSION_ID="12"\n')
    ).toBe('Debian:12');
    expect(osvEcosystem('ID=alpine\nVERSION_ID=3.24.3\n')).toBe('Alpine:v3.24');
    expect(osvEcosystem('ID=fedora\nVERSION_ID=44\n')).toBeUndefined();
  });
});

describe('readTarFiles', () => {
  it('returns only the wanted regular files, normalising ./ prefixes', () => {
    const archive = tar([
      { name: './var/lib/dpkg/status', body: 'Package: bash\n' },
      { name: 'etc/other', body: 'ignored' },
      { name: 'etc/os-release', body: '', type: '2' },
    ]);
    const files = readTarFiles(archive, new Set(['var/lib/dpkg/status', 'etc/os-release']));
    expect([...files]).toEqual([['var/lib/dpkg/status', 'Package: bash\n']]);
  });

  it('applies GNU long names and pax paths to the entry that follows', () => {
    const long = `usr/${'x'.repeat(120)}/status`;
    const archive = tar([
      { name: '././@LongLink', body: `${long}\u0000`, type: 'L' },
      { name: 'truncated', body: 'from-long-name' },
      { name: 'PaxHeaders/1', body: '30 path=lib/apk/db/installed\n', type: 'x' },
      { name: 'short', body: 'from-pax' },
    ]);
    const files = readTarFiles(archive, new Set([long, 'lib/apk/db/installed']));
    expect(files.get(long)).toBe('from-long-name');
    expect(files.get('lib/apk/db/installed')).toBe('from-pax');
  });
});

describe('fixedVersions', () => {
  it('collects fixed events for the matching ecosystem and package only', () => {
    const vuln = {
      id: 'X-1',
      affected: [
        {
          package: { ecosystem: 'Alpine:v3.24', name: 'zlib' },
          ranges: [{ events: [{ introduced: '0' }, { fixed: '1.3.2-r1' }] }],
        },
        {
          package: { ecosystem: 'Alpine:v3.23', name: 'zlib' },
          ranges: [{ events: [{ fixed: '1.3.1-r9' }] }],
        },
      ],
    };
    expect(fixedVersions(vuln, 'Alpine:v3.24', 'zlib')).toEqual(['1.3.2-r1']);
    expect(
      fixedVersions(
        {
          id: 'X-2',
          affected: [
            {
              package: { ecosystem: 'Debian:12', name: 'glibc' },
              ranges: [{ events: [{ introduced: '0' }] }],
            },
          ],
        },
        'Debian:12',
        'glibc'
      )
    ).toEqual([]);
  });
});

describe('satisfiesNodeRange', () => {
  it.each([
    ['26.12.1', '22.x || 24.x || 26.x', true],
    ['26.12.1', '^26.12.1', true],
    ['26.12.0', '^26.12.1', false],
    ['27.0.0', '^26.12.1', false],
    ['26.12.1', '26.12.x', true],
    ['26.13.0', '26.12.x', false],
    ['11.9.0', '<= 11', true],
    ['12.0.0', '<= 11', false],
    ['4.4.0', '>=4.0.0 <4.5.0', true],
    ['4.5.0', '>=4.0.0 <4.5.0', false],
    ['26.0.0', '>= 25.0.0', true],
    ['26.12.1', '26.12.1', true],
  ])('%s in %s -> %s', (version, range, expected) => {
    expect(satisfiesNodeRange(version, range)).toBe(expected);
  });

  it('throws on a range shape it does not understand', () => {
    expect(() => satisfiesNodeRange('26.0.0', '~26.1.0')).toThrow(/Unsupported range/);
  });
});

describe('nodeCoreAdvisories', () => {
  const index = {
    '195': { cve: ['CVE-A'], vulnerable: '24.x || 26.x', patched: '^24.22.1 || ^26.12.1' },
    '12': { cve: ['CVE-OLD'], vulnerable: '<= 11', patched: '' },
    '99': { vulnerable: '26.x' },
  };

  it('reports entries whose vulnerable range matches and patched range does not', () => {
    expect(nodeCoreAdvisories(index, '26.12.0')).toEqual([
      { id: '99', cves: [], patched: '' },
      { id: '195', cves: ['CVE-A'], patched: '^24.22.1 || ^26.12.1' },
    ]);
    expect(nodeCoreAdvisories(index, '26.12.1').map((a) => a.id)).toEqual(['99']);
  });
});

describe('partitionByUpstreamFix', () => {
  const a = { key: 'zlib:X-1', text: 'zlib' };
  const b = { key: 'node:195', text: 'node' };

  it('treats everything as outstanding when the pin is already the current build', () => {
    expect(partitionByUpstreamFix([a, b], undefined)).toEqual({
      fixedUpstream: [],
      outstanding: [a, b],
    });
  });

  it('splits by what the current build still carries', () => {
    expect(partitionByUpstreamFix([a, b], [a])).toEqual({ fixedUpstream: [b], outstanding: [a] });
  });
});

describe('githubAnnotation', () => {
  it('escapes property and message separators', () => {
    expect(
      githubAnnotation({
        level: 'error',
        title: 'pnpm@1: GHSA-x, y',
        message: '50% off\nnext',
        source: { file: 'package.json', line: 8 },
      })
    ).toBe('::error file=package.json,line=8,title=pnpm@1%3A GHSA-x%2C y::50%25 off%0Anext');
  });
});
