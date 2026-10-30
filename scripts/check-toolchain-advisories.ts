/**
 * The OSV scan reads pnpm-lock.yaml, so it never sees the toolchain around the
 * lockfile: the pnpm in `packageManager`, the corepack the Dockerfile installs,
 * the Docker base images and the pinned GitHub Actions. This checks those pins.
 *
 * Fails only on advisories we can act on: a fixed release exists for a package
 * pin, or the image tag's current build no longer has the advisory. Advisories
 * with no fix yet are printed as warnings. Runs on Node's type stripping, with
 * no install step, so it imports the core module by its .ts name.
 *
 * Usage: node scripts/check-toolchain-advisories.ts [--report-only]
 */

import { execFile } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gunzipSync, zstdDecompressSync } from 'node:zlib';
import {
  fixedVersions,
  githubAnnotation,
  nodeCoreAdvisories,
  osvEcosystem,
  partitionByUpstreamFix,
  parseApkInstalled,
  parseDpkgStatus,
  readTarFiles,
  readToolchainPins,
  versionForCommit,
  type Finding,
  type ImageProblem,
  type NodeCoreEntry,
  type OsPackage,
  type OsvVulnerability,
  type PinnedAction,
  type PinnedImage,
  type PinnedPackage,
} from './check-toolchain-advisories.core.ts';

const ROOT = join(import.meta.dirname, '..');
const execFileAsync = promisify(execFile);
const OSV = 'https://api.osv.dev/v1';
const REGISTRY = 'https://registry-1.docker.io/v2';
const NODE_CORE_INDEX =
  'https://raw.githubusercontent.com/nodejs/security-wg/main/vuln/core/index.json';
const OS_FILES = new Set([
  'var/lib/dpkg/status',
  'lib/apk/db/installed',
  'etc/os-release',
  'usr/lib/os-release',
]);
const INDEX_TYPES = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ');

interface Descriptor {
  digest: string;
  mediaType?: string;
  platform?: { architecture?: string; os?: string };
}

interface ImageManifest {
  manifests?: Descriptor[];
  config?: Descriptor;
  layers?: Descriptor[];
}

async function fetchOk(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${url} -> ${res.status}`);
  return res;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return (await (await fetchOk(url, init)).json()) as T;
}

async function osvIdsFor(
  queries: { ecosystem: string; name: string; version: string }[]
): Promise<string[][]> {
  if (queries.length === 0) return [];
  const body = {
    queries: queries.map((q) => ({
      package: { ecosystem: q.ecosystem, name: q.name },
      version: q.version,
    })),
  };
  const res = await fetchJson<{ results: { vulns?: { id: string }[] }[] }>(`${OSV}/querybatch`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  return res.results.map((r) => (r.vulns ?? []).map((v) => v.id));
}

const vulnCache = new Map<string, Promise<OsvVulnerability>>();
function osvVulnerability(id: string): Promise<OsvVulnerability> {
  let pending = vulnCache.get(id);
  if (!pending) {
    pending = fetchJson<OsvVulnerability>(`${OSV}/vulns/${encodeURIComponent(id)}`);
    vulnCache.set(id, pending);
  }
  return pending;
}

interface PackageResult {
  fixable: { id: string; fixed: string[]; summary: string }[];
  unfixed: string[];
}

async function classify(ecosystem: string, name: string, ids: string[]): Promise<PackageResult> {
  const result: PackageResult = { fixable: [], unfixed: [] };
  const vulns = await Promise.all(ids.map((id) => osvVulnerability(id)));
  for (const vuln of vulns) {
    const fixed = fixedVersions(vuln, ecosystem, name);
    if (fixed.length > 0) result.fixable.push({ id: vuln.id, fixed, summary: vuln.summary ?? '' });
    else result.unfixed.push(vuln.id);
  }
  return result;
}

async function registryToken(repository: string): Promise<string> {
  const { token } = await fetchJson<{ token: string }>(
    `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repository}:pull`
  );
  return token;
}

function decompressLayer(blob: Buffer, mediaType: string): Buffer {
  if (mediaType.endsWith('gzip')) return gunzipSync(blob);
  if (mediaType.endsWith('zstd')) return zstdDecompressSync(blob);
  return blob;
}

interface ImageContents {
  nodeVersion: string | undefined;
  files: Map<string, string>;
}

async function readImage(image: PinnedImage, platform: string): Promise<ImageContents> {
  const token = await registryToken(image.repository);
  const headers = { Authorization: `Bearer ${token}`, Accept: INDEX_TYPES };
  const base = `${REGISTRY}/${image.repository}`;
  const [os, architecture] = platform.split('/');
  let manifest = await fetchJson<ImageManifest>(`${base}/manifests/${image.digest}`, { headers });
  if (manifest.manifests) {
    const match = manifest.manifests.find(
      (m) => m.platform?.os === os && m.platform.architecture === architecture
    );
    if (!match) throw new Error(`${image.repository}@${image.digest} has no ${platform} image`);
    manifest = await fetchJson<ImageManifest>(`${base}/manifests/${match.digest}`, { headers });
  }
  if (!manifest.config || !manifest.layers) {
    throw new Error(`${image.repository}@${image.digest}: manifest has no config or layers`);
  }

  const config = await fetchJson<{ config?: { Env?: string[] } }>(
    `${base}/blobs/${manifest.config.digest}`,
    { headers }
  );
  const nodeVersion = config.config?.Env?.find((e) => e.startsWith('NODE_VERSION='))?.slice(13);

  const files = new Map<string, string>();
  for (const layer of manifest.layers) {
    const blob = Buffer.from(
      await (await fetchOk(`${base}/blobs/${layer.digest}`, { headers })).arrayBuffer()
    );
    const tar = decompressLayer(blob, layer.mediaType ?? '');
    for (const [path, text] of readTarFiles(tar, OS_FILES)) files.set(path, text);
  }
  return { nodeVersion, files };
}

function advisories(n: number): string {
  return `${n} ${n === 1 ? 'advisory' : 'advisories'}`;
}

async function currentDigest(image: PinnedImage): Promise<{ digest: string; updated: string }> {
  const tag = await fetchJson<{ digest: string; last_updated: string }>(
    `https://hub.docker.com/v2/repositories/${image.repository}/tags/${image.tag}`
  );
  return { digest: tag.digest, updated: tag.last_updated.slice(0, 10) };
}

interface ImageScan {
  summary: string;
  problems: ImageProblem[];
  present: Set<string>;
}

async function scanImage(
  image: PinnedImage,
  platform: string,
  nodeIndex: () => Promise<Record<string, NodeCoreEntry>>
): Promise<ImageScan> {
  const { nodeVersion, files } = await readImage(image, platform);
  const osRelease = files.get('usr/lib/os-release') ?? files.get('etc/os-release') ?? '';
  const ecosystem = osvEcosystem(osRelease);
  if (!ecosystem) throw new Error(`${image.repository}@${image.digest}: unrecognised OS`);

  const dpkg = files.get('var/lib/dpkg/status');
  const apk = files.get('lib/apk/db/installed');
  const packages: OsPackage[] = dpkg ? parseDpkgStatus(dpkg) : apk ? parseApkInstalled(apk) : [];
  if (packages.length === 0) {
    throw new Error(`${image.repository}@${image.digest}: no OS package database found`);
  }

  const ids = await osvIdsFor(packages.map((p) => ({ ecosystem, ...p })));
  const problems: ImageProblem[] = [];
  const present = new Set<string>();
  let unfixed = 0;
  for (const [i, pkg] of packages.entries()) {
    const hits = ids[i] ?? [];
    for (const id of hits) present.add(`${pkg.name}:${id}`);
    if (hits.length === 0) continue;
    const result = await classify(ecosystem, pkg.name, hits);
    unfixed += result.unfixed.length;
    for (const f of result.fixable) {
      problems.push({
        key: `${pkg.name}:${f.id}`,
        text: `${pkg.name} ${pkg.version}: ${f.id} (fixed in ${f.fixed.join(', ')})`,
      });
    }
  }

  if (nodeVersion) {
    for (const a of nodeCoreAdvisories(await nodeIndex(), nodeVersion)) {
      present.add(`node:${a.id}`);
      problems.push({
        key: `node:${a.id}`,
        text: `Node ${nodeVersion}: ${a.cves.join(', ') || `core advisory ${a.id}`} (patched in ${a.patched})`,
      });
    }
  }

  const node = nodeVersion ? `, Node ${nodeVersion}` : '';
  return {
    summary: `${ecosystem}, ${packages.length} packages${node}: ${problems.length} fixable, ${unfixed} with no fixed release yet`,
    problems,
    present,
  };
}

async function checkImage(
  image: PinnedImage,
  nodeIndex: () => Promise<Record<string, NodeCoreEntry>>
): Promise<Finding[]> {
  const findings: Finding[] = [];
  let current: { digest: string; updated: string } | undefined;
  for (const platform of image.platforms) {
    const label = `${image.repository.replace(/^library\//, '')}:${image.tag} ${platform}`;
    const pinned = await scanImage(image, platform, nodeIndex);
    console.log(`${label} (${pinned.summary})`);
    if (pinned.problems.length === 0) continue;

    current ??= await currentDigest(image);
    const rebuilt = current.digest !== image.digest;
    const latest = rebuilt
      ? await scanImage({ ...image, digest: current.digest }, platform, nodeIndex)
      : undefined;
    if (latest) {
      console.log(
        `${label} current build ${current.digest} from ${current.updated} (${latest.summary})`
      );
    }
    const { fixedUpstream, outstanding } = partitionByUpstreamFix(pinned.problems, latest?.present);

    if (fixedUpstream.length > 0) {
      findings.push({
        level: 'error',
        title: `${label}: newer build fixes ${advisories(fixedUpstream.length)}`,
        message: `${fixedUpstream.map((p) => p.text).join('; ')}. Re-pin to ${current.digest} (built ${current.updated}).`,
        source: image.source,
      });
    }
    if (outstanding.length > 0) {
      findings.push({
        level: 'warning',
        title: `${label}: ${advisories(outstanding.length)} awaiting an upstream rebuild`,
        message: `${outstanding.map((p) => p.text).join('; ')}. ${rebuilt ? 'The current build still carries them.' : 'The pin is already the current build.'}`,
        source: image.source,
      });
    }
  }
  return findings;
}

async function resolveActions(
  actions: PinnedAction[]
): Promise<{ packages: PinnedPackage[]; findings: Finding[] }> {
  const resolved = await Promise.all(
    actions.map(async (action) => {
      const { stdout } = await execFileAsync('git', [
        'ls-remote',
        '--tags',
        `https://github.com/${action.name}.git`,
      ]);
      return { action, version: versionForCommit(stdout, action.sha) };
    })
  );
  const packages: PinnedPackage[] = [];
  const findings: Finding[] = [];
  for (const { action, version } of resolved) {
    if (version) {
      packages.push({
        ecosystem: 'GitHub Actions',
        name: action.name,
        version,
        source: action.source,
      });
    } else {
      findings.push({
        level: 'warning',
        title: `${action.name}@${action.sha.slice(0, 12)}: no release tag`,
        message: 'No version tag points at this commit, so it cannot be checked against OSV.',
        source: action.source,
      });
    }
  }
  return { packages, findings };
}

function workflowFiles(): { path: string; text: string }[] {
  const dirs = [
    '.github/workflows',
    ...readdirSync(join(ROOT, '.github/actions')).map((d) => `.github/actions/${d}`),
  ];
  return dirs.flatMap((dir) =>
    readdirSync(join(ROOT, dir))
      .filter((f) => /\.ya?ml$/.test(f))
      .map((f) => ({ path: `${dir}/${f}`, text: readFileSync(join(ROOT, dir, f), 'utf8') }))
  );
}

async function main(): Promise<void> {
  const reportOnly = process.argv.includes('--report-only');
  const pins = readToolchainPins({
    packageJson: readFileSync(join(ROOT, 'package.json'), 'utf8'),
    dockerfile: readFileSync(join(ROOT, 'Dockerfile'), 'utf8'),
    dockerWorkflow: readFileSync(join(ROOT, '.github/workflows/docker.yml'), 'utf8'),
    workflows: workflowFiles(),
  });
  const actions = await resolveActions(pins.actions);
  const findings: Finding[] = [...actions.findings];
  const packages = [...pins.packages, ...actions.packages];

  const ids = await osvIdsFor(packages);
  let packageAdvisories = 0;
  for (const [i, pin] of packages.entries()) {
    const hits = ids[i] ?? [];
    if (hits.length === 0) continue;
    packageAdvisories += hits.length;
    const result = await classify(pin.ecosystem, pin.name, hits);
    for (const f of result.fixable) {
      findings.push({
        level: 'error',
        title: `${pin.name}@${pin.version}: ${f.id}`,
        message: `${f.summary} Fixed in ${f.fixed.join(', ')}.`,
        source: pin.source,
      });
    }
    for (const id of result.unfixed) {
      findings.push({
        level: 'warning',
        title: `${pin.name}@${pin.version}: ${id}`,
        message: 'No fixed release yet.',
        source: pin.source,
      });
    }
  }
  console.log(
    `${pins.packages.length} package pins and ${pins.actions.length} actions ` +
      `(${actions.packages.length} resolved to a release): ${packageAdvisories === 0 ? 'no advisories' : advisories(packageAdvisories)}`
  );

  let index: Promise<Record<string, NodeCoreEntry>> | undefined;
  const nodeIndex = (): Promise<Record<string, NodeCoreEntry>> =>
    (index ??= fetchJson<Record<string, NodeCoreEntry>>(NODE_CORE_INDEX));
  for (const image of pins.images) findings.push(...(await checkImage(image, nodeIndex)));

  const github = process.env.GITHUB_ACTIONS === 'true';
  for (const f of findings) {
    console.log(
      github
        ? githubAnnotation(f)
        : `${f.level.toUpperCase()} ${f.source.file}:${f.source.line} ${f.title}: ${f.message}`
    );
  }
  const errors = findings.filter((f) => f.level === 'error').length;
  console.log(`${errors} actionable, ${findings.length - errors} warnings`);
  if (errors > 0 && !reportOnly) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
