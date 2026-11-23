/**
 * Lazy destinations that shared components and features warm on intent. The
 * shell registers the imports, because only the shell may import a feature
 * or a shell chunk.
 */
export type WarmDestination = 'designer' | 'baseplate' | 'designGallery';

export type ChunkWarmers = Readonly<Record<WarmDestination, () => Promise<unknown>>>;

let registered: ChunkWarmers | null = null;

export function registerChunkWarmers(warmers: ChunkWarmers): void {
  registered = warmers;
}

/**
 * Starts the destination's chunk fetch. It throws before the shell registers,
 * and its promise rejects when the fetch fails: either way `prefetchOnIntent`
 * releases its one-shot mark, so a later reach tries again.
 */
export function warmChunk(destination: WarmDestination): Promise<unknown> {
  if (registered === null) throw new Error(`No chunk warmers registered (${destination})`);
  return registered[destination]();
}

export function __resetChunkWarmersForTests(): void {
  registered = null;
}
