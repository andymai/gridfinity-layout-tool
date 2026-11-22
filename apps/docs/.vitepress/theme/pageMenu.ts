import { APP_URL } from '../navigation';

export interface PageLinks {
  /** Same-origin, so a preview or a self-hosted copy copies its own build. */
  readonly localMarkdown: string;
  readonly markdown: string;
  readonly claude: string;
  readonly chatgpt: string;
}

// The chat apps fetch the page themselves, so they get the public URL even
// from a preview or a self-hosted copy that they cannot reach.
export function pageLinks(relativePath: string, base = '/docs/'): PageLinks {
  const markdown = `${APP_URL}/docs/${relativePath}`;
  const prompt = encodeURIComponent(
    `Read this page of the Gridfinity Layout Tool docs, then answer my questions about it: ${markdown}`
  );
  return {
    localMarkdown: `${base}${relativePath}`,
    markdown,
    claude: `https://claude.ai/new?q=${prompt}`,
    chatgpt: `https://chatgpt.com/?hints=search&q=${prompt}`,
  };
}
