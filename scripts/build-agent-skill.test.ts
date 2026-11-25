import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  formatMarkdown,
  listServerTools,
  REFERENCE_FILE,
  renderToolReference,
  SKILL_DIR,
  SKILL_NAME,
  skillFiles,
  ZIP_FILE,
} from './build-agent-skill';

const STALE = 'stale: run `pnpm run build:agent-skill` and commit the result';

describe('the published Agent Skill', () => {
  it('has a tool reference that matches the MCP server', async () => {
    const expected = await formatMarkdown(
      renderToolReference(await listServerTools()),
      REFERENCE_FILE
    );
    expect(readFileSync(REFERENCE_FILE, 'utf8'), STALE).toBe(expected);
  });

  it('has a download that holds exactly the Skill folder', () => {
    const zipped = unzipSync(new Uint8Array(readFileSync(ZIP_FILE)));
    const files = skillFiles();
    expect(Object.keys(zipped).sort(), STALE).toEqual([...files.keys()].sort());
    for (const [name, bytes] of files) expect(zipped[name], `${name}: ${STALE}`).toEqual(bytes);
  });

  // The Agent Skills format: the claude.ai upload takes a description of at
  // most 200 characters, and the name must match the folder.
  it('has frontmatter that the Skill hosts accept', () => {
    const text = readFileSync(`${SKILL_DIR}/SKILL.md`, 'utf8');
    const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '';
    const field = (key: string) => new RegExp(`^${key}: (.*)$`, 'm').exec(frontmatter)?.[1];
    expect(field('name')).toBe(SKILL_NAME);
    expect(SKILL_NAME).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    const description = field('description') ?? '';
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(200);
    expect(description).not.toMatch(/[<>]/);
  });

  it('names only tools that the server lists', async () => {
    const listed = new Set((await listServerTools()).map((tool) => tool.name));
    const text = readFileSync(`${SKILL_DIR}/SKILL.md`, 'utf8');
    const named = [...text.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map(([, name]) => name);
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((name) => !listed.has(name))).toEqual([]);
  });
});
