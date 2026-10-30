export interface PinSource {
  file: string;
  line: number;
}

export interface PinnedPackage {
  ecosystem: 'npm' | 'GitHub Actions';
  name: string;
  version: string;
  source: PinSource;
}

export interface PinnedImage {
  repository: string;
  tag: string;
  digest: string;
  source: PinSource;
}

export interface ToolchainPins {
  packages: PinnedPackage[];
  images: PinnedImage[];
}

export interface ToolchainFiles {
  packageJson: string;
  dockerfile: string;
  workflows: { path: string; text: string }[];
}

const FROM_LINE =
  /^FROM\s+(?:--platform=\S+\s+)?([a-z0-9][a-z0-9._/-]*):([A-Za-z0-9._-]+)@(sha256:[0-9a-f]{64})/i;
const COREPACK_PIN = /\bcorepack@(\d+\.\d+\.\d+)\b/;
const ACTION_PIN =
  /uses:\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:\/[^\s@]*)?@[0-9a-f]{40}\s+#\s*v?(\d+(?:\.\d+){0,2})\b/;

function lineOf(text: string, pattern: string): number {
  return text.split('\n').findIndex((l) => l.includes(pattern)) + 1;
}

// Docker Hub is the only registry the image check can read; anything else
// must fail loudly rather than drop out of the scan.
export function dockerHubRepository(image: string): string {
  const first = image.split('/')[0] ?? '';
  if (image.includes('/') && (first.includes('.') || first.includes(':'))) {
    throw new Error(`Unsupported registry for ${image}: only Docker Hub images are scanned`);
  }
  return image.includes('/') ? image : `library/${image}`;
}

export function readToolchainPins(files: ToolchainFiles): ToolchainPins {
  const packages: PinnedPackage[] = [];
  const images: PinnedImage[] = [];

  const manifest: unknown = JSON.parse(files.packageJson);
  const packageManager =
    typeof manifest === 'object' && manifest !== null && 'packageManager' in manifest
      ? manifest.packageManager
      : undefined;
  const pnpm =
    typeof packageManager === 'string' ? /^pnpm@(\d+\.\d+\.\d+)/.exec(packageManager) : null;
  if (pnpm?.[1]) {
    packages.push({
      ecosystem: 'npm',
      name: 'pnpm',
      version: pnpm[1],
      source: { file: 'package.json', line: lineOf(files.packageJson, '"packageManager"') },
    });
  }

  files.dockerfile.split('\n').forEach((line, i) => {
    const from = FROM_LINE.exec(line.trim());
    if (from?.[1] && from[2] && from[3]) {
      images.push({
        repository: dockerHubRepository(from[1]),
        tag: from[2],
        digest: from[3],
        source: { file: 'Dockerfile', line: i + 1 },
      });
    }
    const corepack = COREPACK_PIN.exec(line);
    if (corepack?.[1] && line.trimStart().startsWith('RUN')) {
      packages.push({
        ecosystem: 'npm',
        name: 'corepack',
        version: corepack[1],
        source: { file: 'Dockerfile', line: i + 1 },
      });
    }
  });

  const seen = new Set<string>();
  for (const workflow of files.workflows) {
    workflow.text.split('\n').forEach((line, i) => {
      const action = ACTION_PIN.exec(line);
      if (!action?.[1] || !action[2]) return;
      const key = `${action[1]}@${action[2]}`;
      if (seen.has(key)) return;
      seen.add(key);
      packages.push({
        ecosystem: 'GitHub Actions',
        name: action[1],
        version: action[2],
        source: { file: workflow.path, line: i + 1 },
      });
    });
  }

  return { packages, images };
}

export interface OsPackage {
  name: string;
  version: string;
}

function uniquePackages(list: OsPackage[]): OsPackage[] {
  const byKey = new Map(list.map((p) => [`${p.name}@${p.version}`, p]));
  return [...byKey.values()];
}

// OSV indexes Debian advisories by source package, so binary packages are
// reported under their Source name and version.
export function parseDpkgStatus(text: string): OsPackage[] {
  const packages: OsPackage[] = [];
  for (const paragraph of text.split(/\n\s*\n/)) {
    const fields = new Map<string, string>();
    for (const line of paragraph.split('\n')) {
      const field = /^([A-Za-z-]+):\s?(.*)$/.exec(line);
      if (field?.[1] && field[2] !== undefined) fields.set(field[1], field[2]);
    }
    const name = fields.get('Package');
    const version = fields.get('Version');
    if (!name || !version || !fields.get('Status')?.endsWith(' installed')) continue;
    const source = /^(\S+)(?:\s+\((.+)\))?$/.exec(fields.get('Source') ?? '');
    packages.push(
      source?.[1] ? { name: source[1], version: source[2] ?? version } : { name, version }
    );
  }
  return uniquePackages(packages);
}

export function parseApkInstalled(text: string): OsPackage[] {
  const packages: OsPackage[] = [];
  for (const record of text.split(/\n\s*\n/)) {
    const fields = new Map<string, string>();
    for (const line of record.split('\n')) {
      if (line[1] === ':') fields.set(line.slice(0, 1), line.slice(2));
    }
    const name = fields.get('o') ?? fields.get('P');
    const version = fields.get('V');
    if (name && version) packages.push({ name, version });
  }
  return uniquePackages(packages);
}

export function osvEcosystem(osRelease: string): string | undefined {
  const field = (key: string): string | undefined =>
    new RegExp(`^${key}="?([^"\\n]*)"?$`, 'm').exec(osRelease)?.[1];
  const id = field('ID');
  const version = field('VERSION_ID') ?? '';
  if (id === 'debian') return `Debian:${version.split('.')[0]}`;
  if (id === 'alpine') return `Alpine:v${version.split('.').slice(0, 2).join('.')}`;
  return undefined;
}

const decoder = new TextDecoder();

function cString(bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  return decoder.decode(end === -1 ? bytes : bytes.subarray(0, end));
}

function tarSize(field: Uint8Array): number {
  if ((field[0] ?? 0) & 0x80) {
    return field.subarray(1).reduce((n, b) => n * 256 + b, 0);
  }
  return parseInt(cString(field).trim() || '0', 8);
}

function paxPath(data: Uint8Array): string | undefined {
  return /(?:^|\n)\d+ path=([^\n]*)\n/.exec(decoder.decode(data))?.[1];
}

export function readTarFiles(tar: Uint8Array, wanted: ReadonlySet<string>): Map<string, string> {
  const files = new Map<string, string>();
  let offset = 0;
  let longName: string | undefined;
  let paxName: string | undefined;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const size = tarSize(header.subarray(124, 136));
    const type = String.fromCharCode(header[156] ?? 0);
    const data = tar.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;

    if (type === 'L') {
      longName = cString(data);
      continue;
    }
    if (type === 'x') {
      paxName = paxPath(data);
      continue;
    }
    if (type === 'g') continue;

    const prefix = cString(header.subarray(345, 500));
    const ustarName = cString(header.subarray(0, 100));
    const name = (paxName ?? longName ?? (prefix ? `${prefix}/${ustarName}` : ustarName)).replace(
      /^\.?\//,
      ''
    );
    longName = undefined;
    paxName = undefined;
    if ((type === '0' || type === '\0') && wanted.has(name)) files.set(name, decoder.decode(data));
  }
  return files;
}

export interface OsvVulnerability {
  id: string;
  summary?: string;
  affected?: {
    package?: { ecosystem?: string; name?: string };
    ranges?: {
      events?: { introduced?: string; fixed?: string; last_affected?: string; limit?: string }[];
    }[];
  }[];
}

export function fixedVersions(vuln: OsvVulnerability, ecosystem: string, name: string): string[] {
  const fixed = new Set<string>();
  for (const affected of vuln.affected ?? []) {
    if (affected.package?.ecosystem !== ecosystem || affected.package.name !== name) continue;
    for (const range of affected.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (event.fixed) fixed.add(event.fixed);
      }
    }
  }
  return [...fixed];
}

function parseVersion(version: string): number[] {
  const parts = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(version.trim());
  if (!parts) throw new Error(`Unparseable version: ${version}`);
  return parts.slice(1).flatMap((p) => (p === undefined ? [] : [Number(p)]));
}

// Compares only as many components as `bound` names, so `<= 11` covers 11.x.x.
function comparePrefix(version: number[], bound: number[]): number {
  for (let i = 0; i < bound.length; i++) {
    const diff = (version[i] ?? 0) - (bound[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

function satisfiesComparator(version: number[], comparator: string): boolean {
  if (comparator === '*') return true;
  const xRange = /^(\d+)(?:\.(\d+))?\.x$/.exec(comparator);
  if (xRange) {
    return comparePrefix(version, parseVersion(comparator.replace(/\.x$/, ''))) === 0;
  }
  const caret = /^\^(\d+\.\d+\.\d+)$/.exec(comparator);
  if (caret?.[1]) {
    const bound = parseVersion(caret[1]);
    return version[0] === bound[0] && comparePrefix(version, bound) >= 0;
  }
  const op = /^(<=|>=|<|>|=)?(\d+(?:\.\d+){0,2})$/.exec(comparator);
  if (op?.[2]) {
    const cmp = comparePrefix(version, parseVersion(op[2]));
    switch (op[1]) {
      case '<=':
        return cmp <= 0;
      case '>=':
        return cmp >= 0;
      case '<':
        return cmp < 0;
      case '>':
        return cmp > 0;
      default:
        return cmp === 0;
    }
  }
  throw new Error(`Unsupported range comparator: ${comparator}`);
}

export function satisfiesNodeRange(version: string, range: string): boolean {
  const parsed = parseVersion(version);
  return range
    .split('||')
    .map((alt) => alt.trim().replace(/(<=|>=|<|>)\s+/g, '$1'))
    .filter((alt) => alt.length > 0)
    .some((alt) => alt.split(/\s+/).every((c) => satisfiesComparator(parsed, c)));
}

export interface NodeCoreEntry {
  cve?: string[];
  vulnerable?: string;
  patched?: string;
}

export interface NodeCoreAdvisory {
  id: string;
  cves: string[];
  patched: string;
}

export function nodeCoreAdvisories(
  index: Record<string, NodeCoreEntry>,
  version: string
): NodeCoreAdvisory[] {
  return Object.entries(index)
    .filter(
      ([, e]) =>
        e.vulnerable &&
        satisfiesNodeRange(version, e.vulnerable) &&
        !(e.patched && satisfiesNodeRange(version, e.patched))
    )
    .map(([id, e]) => ({ id, cves: e.cve ?? [], patched: e.patched ?? '' }));
}

export interface ImageProblem {
  key: string;
  text: string;
}

// An image advisory is ours to fix only when the tag's current build no longer
// has it; otherwise re-pinning changes nothing and the wait is on upstream.
export function partitionByUpstreamFix(
  pinned: ImageProblem[],
  current: ImageProblem[] | undefined
): { fixedUpstream: ImageProblem[]; outstanding: ImageProblem[] } {
  if (!current) return { fixedUpstream: [], outstanding: pinned };
  const stillPresent = new Set(current.map((p) => p.key));
  return {
    fixedUpstream: pinned.filter((p) => !stillPresent.has(p.key)),
    outstanding: pinned.filter((p) => stillPresent.has(p.key)),
  };
}

export interface Finding {
  level: 'error' | 'warning';
  title: string;
  message: string;
  source: PinSource;
}

function escapeData(s: string): string {
  return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function escapeProperty(s: string): string {
  return escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

export function githubAnnotation(finding: Finding): string {
  const props = [
    `file=${escapeProperty(finding.source.file)}`,
    `line=${finding.source.line}`,
    `title=${escapeProperty(finding.title)}`,
  ].join(',');
  return `::${finding.level} ${props}::${escapeData(finding.message)}`;
}
