/**
 * Labs Button
 *
 * Entry point button for the Labs drawer. Shows in the sidebar with a badge
 * indicating the number of enabled experimental features.
 */

import { useLabsStore } from '../../store/labs';

export function LabsButton() {
  const openDrawer = useLabsStore((state) => state.openDrawer);
  const enabledCount = useLabsStore((state) => state.getEnabledCount());

  return (
    <button
      onClick={openDrawer}
      className="flex items-center gap-2 w-full px-3 py-2 text-content-secondary hover:text-content hover:bg-surface-hover rounded-md transition-colors"
      aria-label={`Open Labs experimental features${enabledCount > 0 ? `, ${enabledCount} enabled` : ''}`}
    >
      <SparklesIcon className="w-[18px] h-[18px] flex-shrink-0" />
      <div className="flex-1 text-left">
        <div className="text-sm font-medium">Labs</div>
        <div className="text-[11px] text-content-tertiary">Try experimental features</div>
      </div>
      {enabledCount > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[11px] font-semibold text-white bg-accent rounded-full">
          {enabledCount > 9 ? '9+' : enabledCount}
        </span>
      )}
    </button>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  );
}
