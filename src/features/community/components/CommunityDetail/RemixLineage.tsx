/**
 * Where a remix came from, as a navigable strip rather than a sentence.
 *
 * Deliberately not called a tree: the stored lineage is only `parentId` and
 * `rootId`, so when those differ there may be steps in between that were never
 * recorded. Drawing a continuous chain would imply completeness the data does
 * not have, so the gap is stated instead of smoothed over.
 */

import { Button, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { CommunityDesignLineage } from '@/shared/types/community';
import type { ParentResolution } from './CommunityDetailContent';

export interface RemixLineageProps {
  lineage: CommunityDesignLineage;
  /** Whether the parent is still live, a name snapshot, or gone. */
  parentResolution: ParentResolution;
  /** Current design's own name, shown as the last step. */
  designName: string;
  /** Opens an ancestor in the detail view; absent renders the strip read-only. */
  onOpenDesign?: (designId: string) => void;
}

function Step({
  label,
  sub,
  current = false,
  isLast = false,
  onOpen,
  openAria,
  testId,
}: {
  label: string;
  sub?: string;
  current?: boolean;
  /** Suppresses the connector rule; there is nothing below to connect to. */
  isLast?: boolean;
  onOpen?: () => void;
  openAria?: string;
  testId: string;
}) {
  const body = (
    <>
      <span className="block truncate text-sm text-content">{label}</span>
      {sub !== undefined && (
        <span className="block truncate text-xs text-content-tertiary">{sub}</span>
      )}
    </>
  );

  return (
    <li className="relative pl-4" data-testid={testId}>
      {/* Connector: a dot on the step and a rule down to the next one. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-0 top-1.5 h-2 w-2 rounded-full',
          current ? 'bg-accent' : 'bg-stroke-subtle'
        )}
      />
      {/* Rendered conditionally rather than via `last:`, which resolves
          against this span's siblings inside the li and so never matched. */}
      {!isLast && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-[3px] top-3.5 w-px bg-stroke-subtle"
        />
      )}
      {onOpen === undefined ? (
        <div className={cn('min-w-0', current && 'font-medium')}>{body}</div>
      ) : (
        <Button
          variant="ghost"
          aria-label={openAria}
          onClick={onOpen}
          className="h-auto w-full min-w-0 justify-start p-0 text-left font-normal underline-offset-2 hover:underline"
        >
          <span className="min-w-0">{body}</span>
        </Button>
      )}
    </li>
  );
}

export function RemixLineage({
  lineage,
  parentResolution,
  designName,
  onOpenDesign,
}: RemixLineageProps) {
  const t = useTranslation();

  const parentGone = parentResolution.kind === 'gone';
  const parentName = parentResolution.kind === 'live' ? parentResolution.name : lineage.parentName;
  const parentAuthor =
    parentResolution.kind === 'live' ? parentResolution.authorName : lineage.parentAuthorName;

  const hasSeparateRoot = lineage.rootId !== lineage.parentId;

  return (
    <div className="space-y-1" data-testid="remix-lineage">
      <h3 className="text-sm font-medium text-content">{t('community.lineage.title')}</h3>

      {/* role="list" restores list semantics that Safari/iOS VoiceOver strips when list-style:none is applied. */}
      <ul role="list" className="space-y-2">
        {hasSeparateRoot && (
          <Step
            testId="remix-lineage-root"
            label={t('community.lineage.root', { author: lineage.rootAuthorName })}
            onOpen={onOpenDesign === undefined ? undefined : () => onOpenDesign(lineage.rootId)}
            openAria={t('community.lineage.openRoot', { author: lineage.rootAuthorName })}
          />
        )}

        <Step
          testId="remix-lineage-parent"
          label={parentName}
          sub={
            parentGone
              ? t('community.lineage.unavailable')
              : t('community.lineage.byAuthor', { author: parentAuthor })
          }
          // A gone parent is not openable: the detail fetch would 404, and a
          // dead link is worse than a plainly labelled dead end.
          onOpen={
            onOpenDesign === undefined || parentGone
              ? undefined
              : () => onOpenDesign(lineage.parentId)
          }
          openAria={t('community.lineage.openParent', { name: parentName })}
        />

        <Step
          testId="remix-lineage-current"
          label={designName}
          sub={t('community.lineage.thisDesign')}
          current
          isLast
        />
      </ul>

      {hasSeparateRoot && (
        <p className="text-xs text-content-tertiary" data-testid="remix-lineage-gap">
          {t('community.lineage.gap')}
        </p>
      )}
    </div>
  );
}
