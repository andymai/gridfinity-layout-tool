interface PrintListEmptyProps {
  /** Compact mode for inline placement */
  compact?: boolean;
}

/**
 * Empty state for print list when no bins are placed.
 */
export function PrintListEmpty({ compact = false }: PrintListEmptyProps) {
  if (compact) {
    return (
      <div className="py-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-surface-elevated">
          <svg
            className="w-8 h-8 text-content-disabled"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-content-secondary">No bins to print</p>
        <p className="text-sm mt-1 text-content-disabled">
          Draw bins on the grid to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="empty-state py-6 px-4">
      <div className="empty-state-icon">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <p className="text-sm text-content-secondary mb-1">No bins placed yet</p>
      <p className="text-xs text-content-disabled">Draw or click to place bins on the grid</p>
    </div>
  );
}
