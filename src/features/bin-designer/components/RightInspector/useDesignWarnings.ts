/**
 * Aggregates the design's user-facing warnings into one read-only roll-up for
 * the right inspector. Each warning carries an optional `jumpTarget` that
 * deep-links to the left-panel control that fixes it (via the existing
 * help-jump dispatcher — no new event wiring).
 *
 * This is a roll-up, not a relocation: the inline warnings (e.g. LidSection's
 * own list) stay put. Sources are limited to the translated, user-reachable
 * ones — lid compatibility, split-needed, and mesh-generation failure.
 * `validateBinParams`/`validateCompartmentSizes` are intentionally excluded:
 * their messages are hardcoded English and their violations are already
 * prevented by the clamping inputs.
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { checkLidCompatibility } from '@/features/bin-designer/utils/lidCompatibility';
import type { HelpTarget } from '@/shared/help/helpEntry';

export type WarningSeverity = 'blocker' | 'warning';

export interface DesignWarning {
  readonly id: string;
  readonly severity: WarningSeverity;
  /** Already-translated, ready to render. */
  readonly message: string;
  readonly jumpTarget?: HelpTarget;
}

export interface DesignWarningsOptions {
  readonly needsSplit?: boolean;
  readonly splitPieceCount?: number;
  readonly meshError?: string | null;
}

export function useDesignWarnings(options: DesignWarningsOptions = {}): readonly DesignWarning[] {
  const t = useTranslation();
  const params = useDesignerStore(useShallow((s) => s.params));
  const { needsSplit, splitPieceCount, meshError } = options;

  return useMemo<readonly DesignWarning[]>(() => {
    const warnings: DesignWarning[] = [];

    // Mesh generation failure — blocks export, so it leads.
    if (meshError) {
      warnings.push({
        id: 'mesh-error',
        severity: 'blocker',
        message: t('binDesigner.inspector.warnings.meshError'),
      });
    }

    // Click-lock lid compatibility — only meaningful when the lid is enabled.
    // checkLidCompatibility already returns issues sorted blockers-first.
    if (params.lid.enabled) {
      for (const issue of checkLidCompatibility(params)) {
        const sides = issue.sides
          ? issue.sides.map((s) => t(`binDesigner.lid.side.${s}`)).join(', ')
          : '';
        warnings.push({
          id: `lid:${issue.id}`,
          severity: issue.severity,
          message: t(`binDesigner.lid.compat.${issue.id}`, { sides }),
          jumpTarget: { surface: 'binDesigner:shape', controlId: 'bd-lid' },
        });
      }
    }

    // Bin exceeds the print bed → split into multiple pieces on export.
    if (needsSplit) {
      warnings.push({
        id: 'split',
        severity: 'warning',
        message: t('binDesigner.inspector.warnings.split', { count: splitPieceCount ?? 0 }),
      });
    }

    return warnings;
  }, [t, params, needsSplit, splitPieceCount, meshError]);
}
