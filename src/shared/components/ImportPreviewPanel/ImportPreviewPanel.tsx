import { Fragment } from 'react';
import type { ReactNode } from 'react';

export interface ImportPreviewRow {
  readonly label: string;
  readonly value: ReactNode;
  readonly emphasis?: boolean;
}

export function ImportPreviewPanel({
  title,
  rows,
}: {
  title: string;
  rows: readonly ImportPreviewRow[];
}) {
  return (
    <div className="bg-success-muted border border-success rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 text-sm font-medium text-success mb-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {title}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-success/80">
        {rows.map((row, index) => (
          <Fragment key={index}>
            <div>{row.label}</div>
            <div className={row.emphasis ? 'font-medium' : undefined}>{row.value}</div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
