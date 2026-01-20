/**
 * Community Resources Section - Links to Gridfinity ecosystem.
 * Provides valuable outbound links that help users discover resources
 * and establish the tool as a central hub in the Gridfinity community.
 */

import { CollapsibleSection } from './CollapsibleSection';
import { ShareBadge } from './ShareBadge';

interface ResourceLink {
  name: string;
  url: string;
  description: string;
  icon: React.ReactNode;
}

const stlResources: ResourceLink[] = [
  {
    name: 'Printables',
    url: 'https://www.printables.com/search/models?q=gridfinity',
    description: 'Community STL files',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l6.9 3.45L12 11.08 5.1 7.63 12 4.18zM4 8.82l7 3.5v7.36l-7-3.5V8.82zm9 10.86v-7.36l7-3.5v7.36l-7 3.5z" />
      </svg>
    ),
  },
  {
    name: 'Thangs',
    url: 'https://thangs.com/search/gridfinity',
    description: 'AI-powered 3D search',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.36.2-.78.2-1.14 0l-7.9-4.44A.991.991 0 013 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.36-.2.78-.2 1.14 0l7.9 4.44c.32.17.53.5.53.88v9z" />
      </svg>
    ),
  },
  {
    name: 'MakerWorld',
    url: 'https://makerworld.com/en/search/models?keyword=gridfinity',
    description: 'Bambu Lab community',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-8v4h2v-4h3l-4-4-4 4h3z" />
      </svg>
    ),
  },
  {
    name: 'Thingiverse',
    url: 'https://www.thingiverse.com/search?q=gridfinity',
    description: 'Classic STL library',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.998 0c-1.318 0-2.61.133-3.865.393v4.515h7.74V.393C14.612.133 13.318 0 11.998 0zM7.17 1.25A11.932 11.932 0 002.04 5.25h5.13V1.25zm9.66 0v4h5.13a11.932 11.932 0 00-5.13-4zM.623 6.21A11.928 11.928 0 000 10.17h7.133V6.21H.623zm8.24 0v3.96h6.274V6.21H8.864zm7.24 0v3.96H24a11.928 11.928 0 00-.623-3.96h-7.274zM0 11.13c.012 1.37.22 2.698.623 3.96H7.9l-.767-3.96H0zm8.13 0l.768 3.96h6.205l.767-3.96H8.13zM16.1 11.13l-.767 3.96h7.275c.402-1.262.61-2.59.623-3.96h-7.13zM2.04 16.05a11.932 11.932 0 005.13 4v-4h-5.13zm6.09 0v4h7.74v-4h-7.74zm8.7 0v4a11.932 11.932 0 005.13-4h-5.13zM8.133 21.02v2.585a11.93 11.93 0 007.74 0V21.02h-7.74z" />
      </svg>
    ),
  },
];

const communityResources: ResourceLink[] = [
  {
    name: 'r/gridfinity',
    url: 'https://www.reddit.com/r/gridfinity/',
    description: 'Reddit community',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701z" />
      </svg>
    ),
  },
  {
    name: 'Gridfinity Discord',
    url: 'https://discord.gg/gridfinity',
    description: 'Chat with makers',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
      </svg>
    ),
  },
  {
    name: 'Zack Freedman',
    url: 'https://www.youtube.com/c/ZackFreedman',
    description: 'Gridfinity creator',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
];

const toolResources: ResourceLink[] = [
  {
    name: 'Gridfinity Rebuilt',
    url: 'https://github.com/kennetek/gridfinity-rebuilt-openscad',
    description: 'OpenSCAD generator',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
  },
  {
    name: 'Layout Tool GitHub',
    url: 'https://github.com/andymai/gridfinity-layout-tool',
    description: 'Star & contribute',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
  },
];

export function CommunityResourcesSection() {
  return (
    <CollapsibleSection title="Community Resources" variant="default" defaultExpanded={false}>
      <div className="space-y-3">
        {/* STL Resources */}
        <div>
          <div className="text-[10px] text-content-disabled uppercase tracking-wider mb-1.5">
            Find STL Files
          </div>
          <div className="space-y-1">
            {stlResources.map((resource) => (
              <a
                key={resource.name}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs py-1 px-1.5 -mx-1.5 rounded hover:bg-surface-hover transition-colors group"
              >
                <span className="text-content-tertiary group-hover:text-accent transition-colors">
                  {resource.icon}
                </span>
                <span className="flex-1 text-content-secondary group-hover:text-content transition-colors">
                  {resource.name}
                </span>
                <span className="text-[10px] text-content-disabled hidden sm:inline">
                  {resource.description}
                </span>
                <svg
                  className="w-3 h-3 text-content-disabled opacity-0 group-hover:opacity-100 transition-opacity"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            ))}
          </div>
        </div>

        {/* Community */}
        <div>
          <div className="text-[10px] text-content-disabled uppercase tracking-wider mb-1.5">
            Community
          </div>
          <div className="space-y-1">
            {communityResources.map((resource) => (
              <a
                key={resource.name}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs py-1 px-1.5 -mx-1.5 rounded hover:bg-surface-hover transition-colors group"
              >
                <span className="text-content-tertiary group-hover:text-accent transition-colors">
                  {resource.icon}
                </span>
                <span className="flex-1 text-content-secondary group-hover:text-content transition-colors">
                  {resource.name}
                </span>
                <span className="text-[10px] text-content-disabled hidden sm:inline">
                  {resource.description}
                </span>
                <svg
                  className="w-3 h-3 text-content-disabled opacity-0 group-hover:opacity-100 transition-opacity"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            ))}
          </div>
        </div>

        {/* Tools & GitHub */}
        <div>
          <div className="text-[10px] text-content-disabled uppercase tracking-wider mb-1.5">
            Tools & Generators
          </div>
          <div className="space-y-1">
            {toolResources.map((resource) => (
              <a
                key={resource.name}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs py-1 px-1.5 -mx-1.5 rounded hover:bg-surface-hover transition-colors group"
              >
                <span className="text-content-tertiary group-hover:text-accent transition-colors">
                  {resource.icon}
                </span>
                <span className="flex-1 text-content-secondary group-hover:text-content transition-colors">
                  {resource.name}
                </span>
                <span className="text-[10px] text-content-disabled hidden sm:inline">
                  {resource.description}
                </span>
                <svg
                  className="w-3 h-3 text-content-disabled opacity-0 group-hover:opacity-100 transition-opacity"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            ))}
          </div>
        </div>

        {/* Share Badge */}
        <div className="pt-2 border-t border-stroke-subtle">
          <div className="text-[10px] text-content-disabled uppercase tracking-wider mb-1.5">
            Link to This Tool
          </div>
          <ShareBadge />
        </div>
      </div>
    </CollapsibleSection>
  );
}
