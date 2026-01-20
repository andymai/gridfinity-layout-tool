/**
 * Share Badge Component - Generates embed code for users to link back to the tool.
 *
 * This component provides copyable HTML/Markdown snippets that users can add to:
 * - Their Printables/Thangs/MakerWorld project pages
 * - Blog posts and tutorials
 * - GitHub READMEs
 * - Forum posts
 *
 * Each badge includes a backlink to the Gridfinity Layout Tool, encouraging
 * organic link building from the maker community.
 */

import { useState } from 'react';

type BadgeFormat = 'html' | 'markdown' | 'bbcode';

interface BadgeVariant {
  name: string;
  description: string;
  html: string;
  markdown: string;
  bbcode: string;
}

const SITE_URL = 'https://gridfinitylayouttool.com';

const badges: BadgeVariant[] = [
  {
    name: 'Planned with Gridfinity Layout Tool',
    description: 'Simple text link',
    html: `<a href="${SITE_URL}" target="_blank" rel="noopener">Planned with Gridfinity Layout Tool</a>`,
    markdown: `[Planned with Gridfinity Layout Tool](${SITE_URL})`,
    bbcode: `[url=${SITE_URL}]Planned with Gridfinity Layout Tool[/url]`,
  },
  {
    name: 'Layout designed using...',
    description: 'Descriptive link',
    html: `Layout designed using <a href="${SITE_URL}" target="_blank" rel="noopener">Gridfinity Layout Tool</a> - free online planner for 3D printed drawer organizers.`,
    markdown: `Layout designed using [Gridfinity Layout Tool](${SITE_URL}) - free online planner for 3D printed drawer organizers.`,
    bbcode: `Layout designed using [url=${SITE_URL}]Gridfinity Layout Tool[/url] - free online planner for 3D printed drawer organizers.`,
  },
  {
    name: 'Plan your own',
    description: 'Call-to-action link',
    html: `Plan your own Gridfinity layout at <a href="${SITE_URL}" target="_blank" rel="noopener">gridfinitylayouttool.com</a>`,
    markdown: `Plan your own Gridfinity layout at [gridfinitylayouttool.com](${SITE_URL})`,
    bbcode: `Plan your own Gridfinity layout at [url=${SITE_URL}]gridfinitylayouttool.com[/url]`,
  },
];

export function ShareBadge() {
  const [selectedBadge, setSelectedBadge] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState<BadgeFormat>('html');
  const [copied, setCopied] = useState(false);

  const badge = badges[selectedBadge];
  const code = badge[selectedFormat];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-content-secondary">
        Add a link to your Printables page, blog, or project description:
      </div>

      {/* Badge selector */}
      <div className="space-y-1">
        {badges.map((b, index) => (
          <button
            key={index}
            onClick={() => setSelectedBadge(index)}
            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
              selectedBadge === index
                ? 'bg-accent/10 text-accent border border-accent/30'
                : 'bg-surface hover:bg-surface-hover text-content-secondary border border-transparent'
            }`}
          >
            <div className="font-medium">{b.name}</div>
            <div className="text-[10px] text-content-tertiary">{b.description}</div>
          </button>
        ))}
      </div>

      {/* Format selector */}
      <div className="flex gap-1 bg-surface rounded p-0.5">
        {(['html', 'markdown', 'bbcode'] as BadgeFormat[]).map((format) => (
          <button
            key={format}
            onClick={() => setSelectedFormat(format)}
            className={`flex-1 py-1 px-2 rounded text-[10px] uppercase tracking-wide transition-colors ${
              selectedFormat === format
                ? 'bg-accent text-white'
                : 'text-content-tertiary hover:text-content'
            }`}
          >
            {format}
          </button>
        ))}
      </div>

      {/* Code preview */}
      <div className="relative">
        <pre className="bg-surface rounded p-2 text-[10px] text-content-secondary overflow-x-auto whitespace-pre-wrap break-all font-mono">
          {code}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-1 right-1 px-2 py-0.5 rounded bg-surface-elevated hover:bg-surface-hover text-[10px] text-content-secondary transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Preview */}
      <div className="bg-surface rounded p-2">
        <div className="text-[10px] text-content-disabled mb-1">Preview:</div>
        <div
          className="text-xs text-content"
          dangerouslySetInnerHTML={{
            __html: badge.html.replace(
              'target="_blank"',
              'target="_blank" class="text-accent hover:underline"'
            ),
          }}
        />
      </div>
    </div>
  );
}
