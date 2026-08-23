/**
 * Everything about the thing being published, as opposed to everything the
 * publisher types. Preview, size, detected techniques and remix lineage are
 * all facts derived from the design, so they sit together in one column and
 * stay legible while the form beside them is edited.
 */

import { useTranslation } from '@/i18n';
import type { BinParams } from '@/shared/types/bin';
import type { CommunityDesignLineage } from '@/shared/types/community';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
import { deriveTechniques } from '@/shared/utils/communityTechniques';
import { PublishPreview } from './PublishPreview';
import {
  formatAssemblyGridSize,
  formatAssemblyMillimetres,
  formatGridSize,
  formatMillimetres,
} from './publishSummary';
import type { PublishAssemblyContent } from './publishSummary';

export interface PublishArtefactProps {
  thumbnails: readonly string[] | null;
  captureFailed: boolean;
  params?: BinParams;
  assembly?: PublishAssemblyContent | null;
  lineage: CommunityDesignLineage | null;
  onRetryCapture: () => void;
}

export function PublishArtefact({
  thumbnails,
  captureFailed,
  params,
  assembly,
  lineage,
  onRetryCapture,
}: PublishArtefactProps) {
  const t = useTranslation();
  const techniques = params !== undefined ? deriveTechniques(params) : ['workshop' as const];

  // Only worth a line when the root is a third party: a root that is the
  // parent, or the parent's own author, says nothing the parent line has not.
  const showRootLine =
    lineage !== null &&
    lineage.parentId !== lineage.rootId &&
    lineage.rootAuthorName !== '' &&
    lineage.rootAuthorName !== lineage.parentAuthorName;

  return (
    <div className="space-y-3">
      <PublishPreview
        thumbnails={thumbnails}
        captureFailed={captureFailed}
        onRetry={onRetryCapture}
      />

      <div>
        <p className="text-sm font-medium text-content">
          {params !== undefined
            ? formatGridSize(params)
            : assembly
              ? formatAssemblyGridSize(assembly)
              : ''}
        </p>
        <p className="text-xs text-content-tertiary">
          {params !== undefined ? (
            <>
              {formatMillimetres(params)} ·{' '}
              {t('community.publish.form.wallsSummary', { thickness: params.wallThickness })}
            </>
          ) : assembly ? (
            <>
              {formatAssemblyMillimetres(assembly)} ·{' '}
              {t('community.publish.form.floorSummary', {
                thickness: assembly.structure.base.floorThickness,
              })}
            </>
          ) : null}
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-content-tertiary">
          {t('community.publish.form.techniquesLabel')}
        </p>
        {techniques.length === 0 ? (
          <p className="mt-1 text-sm text-content-secondary">
            {t('community.publish.form.techniquesNone')}
          </p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {techniques.map((technique) => (
              <li
                key={technique}
                className="rounded-full bg-surface-hover px-2.5 py-0.5 text-xs text-content-secondary"
              >
                {t(TECHNIQUE_CONFIG[technique].labelKey)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {lineage !== null && (
        <div className="rounded-md bg-surface-hover px-3 py-2 text-xs text-content-secondary">
          <p>
            {t('community.publish.form.lineageNotice', {
              parent: lineage.parentName,
              author: lineage.parentAuthorName,
            })}
          </p>
          {showRootLine && (
            <p>
              {t('community.publish.form.lineageNoticeRoot', {
                author: lineage.rootAuthorName,
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
