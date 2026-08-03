import { useMemo } from 'react';
import { Field, Input, Select, SegmentedControl, Textarea } from '@/design-system';
import type { SelectOption } from '@/design-system';
import { useTranslation } from '@/i18n';
import {
  COMMUNITY_PRINT_MATERIALS,
  COMMUNITY_PRINT_MAX_PHOTOS,
  COMMUNITY_PRINT_NOTE_MAX_LENGTH,
} from '@/shared/types/communityPrint';
import type {
  CommunityPrintFitVerdict,
  CommunityPrintMaterial,
} from '@/shared/types/communityPrint';
import { COMMUNITY_PRINTER_OTHER, COMMUNITY_PRINTERS } from '@/shared/types/communityPrinters';
import type { PrintDraft, PrintDraftIssues, PrintPhotoSlot } from '../../store/printDialogStore';
import { PrintPhotoPicker } from './PrintPhotoPicker';

export interface PrintFormProps {
  draft: PrintDraft;
  displayName: string;
  photos: readonly PrintPhotoSlot[];
  photoError: string | null;
  /** Populated only after a submit attempt, so the form does not scold as you type. */
  issues: PrintDraftIssues;
  disabled: boolean;
  onDraftChange: (patch: Partial<PrintDraft>) => void;
  onDisplayNameChange: (name: string) => void;
  onAddPhoto: (dataUrl: string) => void;
  onRemovePhoto: (index: number) => void;
  onPhotoError: (message: string | null) => void;
}

/**
 * Material names are acronyms that read the same in every locale, so they are
 * rendered from the enum rather than through i18n. Only "other" is ordinary UI
 * copy and gets a translated label.
 */
function materialLabel(material: CommunityPrintMaterial, otherLabel: string): string {
  return material === 'other' ? otherLabel : material.toUpperCase();
}

export function PrintForm({
  draft,
  displayName,
  photos,
  photoError,
  issues,
  disabled,
  onDraftChange,
  onDisplayNameChange,
  onAddPhoto,
  onRemovePhoto,
  onPhotoError,
}: PrintFormProps) {
  const t = useTranslation();

  const printerOptions = useMemo<SelectOption[]>(
    () => [
      { id: '', name: t('community.print.printerPlaceholder') },
      ...COMMUNITY_PRINTERS.map((printer) => ({
        id: printer.id,
        // The curated labels are hardware model names and stay as authored;
        // only the "Other" sentinel takes a translated label.
        name:
          printer.id === COMMUNITY_PRINTER_OTHER ? t('community.print.otherOption') : printer.label,
      })),
    ],
    [t]
  );

  const materialOptions = useMemo<SelectOption[]>(
    () =>
      COMMUNITY_PRINT_MATERIALS.map((material) => ({
        id: material,
        name: materialLabel(material, t('community.print.otherOption')),
      })),
    [t]
  );

  const fitOptions = useMemo(
    () => [
      { value: 'as-designed' as const, label: t('community.print.fit.asDesigned') },
      { value: 'adjusted' as const, label: t('community.print.fit.adjusted') },
      { value: 'did-not-fit' as const, label: t('community.print.fit.didNotFit') },
    ],
    [t]
  );

  return (
    <div className="space-y-4" data-testid="print-form">
      <Field
        label={t('community.print.nameLabel')}
        htmlFor="print-name"
        error={issues.displayName === undefined ? undefined : t('community.print.nameRequired')}
      >
        <Input
          id="print-name"
          value={displayName}
          disabled={disabled}
          maxLength={32}
          placeholder={t('community.print.namePlaceholder')}
          onChange={(event) => onDisplayNameChange(event.target.value)}
        />
      </Field>

      <Field
        label={t('community.print.printerLabel')}
        htmlFor="print-printer"
        error={
          issues.printer === 'required'
            ? t('community.print.printerRequired')
            : issues.printer === 'otherRequired'
              ? t('community.print.printerOtherRequired')
              : undefined
        }
      >
        <Select
          id="print-printer"
          options={printerOptions}
          value={draft.printer}
          disabled={disabled}
          onValueChange={(value) => onDraftChange({ printer: value })}
        />
      </Field>

      {draft.printer === COMMUNITY_PRINTER_OTHER && (
        <Field label={t('community.print.printerOtherLabel')} htmlFor="print-printer-other">
          <Input
            id="print-printer-other"
            value={draft.printerOther}
            disabled={disabled}
            maxLength={40}
            placeholder={t('community.print.printerOtherPlaceholder')}
            onChange={(event) => onDraftChange({ printerOther: event.target.value })}
          />
        </Field>
      )}

      <div className="space-y-3 rounded-lg border border-stroke-subtle p-3">
        <h3 className="text-sm font-medium text-content">{t('community.print.settingsTitle')}</h3>

        <Field label={t('community.print.materialLabel')} htmlFor="print-material">
          <Select
            id="print-material"
            options={materialOptions}
            value={draft.material}
            disabled={disabled}
            onValueChange={(value) => onDraftChange({ material: value as CommunityPrintMaterial })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t('community.print.nozzleLabel')}
            htmlFor="print-nozzle"
            trailing="mm"
            error={issues.nozzleMm === undefined ? undefined : t('community.print.nozzleRequired')}
          >
            <Input
              id="print-nozzle"
              inputMode="decimal"
              value={draft.nozzleMm}
              disabled={disabled}
              onChange={(event) => onDraftChange({ nozzleMm: event.target.value })}
            />
          </Field>

          <Field
            label={t('community.print.layerHeightLabel')}
            htmlFor="print-layer-height"
            trailing="mm"
            error={
              issues.layerHeightMm === undefined
                ? undefined
                : t('community.print.layerHeightRequired')
            }
          >
            <Input
              id="print-layer-height"
              inputMode="decimal"
              value={draft.layerHeightMm}
              disabled={disabled}
              onChange={(event) => onDraftChange({ layerHeightMm: event.target.value })}
            />
          </Field>
        </div>

        <Field
          label={t('community.print.printTimeLabel')}
          error={
            issues.printTime === undefined ? undefined : t('community.print.printTimeRequired')
          }
        >
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              value={draft.printHours}
              disabled={disabled}
              aria-label={t('community.print.hoursLabel')}
              placeholder={t('community.print.hoursLabel')}
              onChange={(event) => onDraftChange({ printHours: event.target.value })}
              data-testid="print-hours"
            />
            <Input
              inputMode="numeric"
              value={draft.printMinutes}
              disabled={disabled}
              aria-label={t('community.print.minutesLabel')}
              placeholder={t('community.print.minutesLabel')}
              onChange={(event) => onDraftChange({ printMinutes: event.target.value })}
              data-testid="print-minutes"
            />
          </div>
        </Field>

        <Field
          label={t('community.print.filamentLabel')}
          htmlFor="print-filament"
          trailing="g"
          hint={t('community.print.filamentHint')}
        >
          <Input
            id="print-filament"
            inputMode="decimal"
            value={draft.filamentGrams}
            disabled={disabled}
            onChange={(event) => onDraftChange({ filamentGrams: event.target.value })}
          />
        </Field>
      </div>

      {/* The whole point of the feature: no default is pre-selected, because a
          verdict nobody consciously chose is worse than no verdict at all. */}
      <Field
        label={t('community.print.fitTitle')}
        hint={t('community.print.fitHint')}
        error={issues.fitVerdict === undefined ? undefined : t('community.print.fitRequired')}
      >
        <SegmentedControl
          options={fitOptions}
          value={draft.fitVerdict ?? ('' as CommunityPrintFitVerdict)}
          onChange={(value) => onDraftChange({ fitVerdict: value })}
          aria-label={t('community.print.fitTitle')}
        />
      </Field>

      <Field label={t('community.print.noteLabel')} htmlFor="print-note">
        <Textarea
          id="print-note"
          rows={3}
          value={draft.note}
          disabled={disabled}
          maxLength={COMMUNITY_PRINT_NOTE_MAX_LENGTH}
          placeholder={t('community.print.notePlaceholder')}
          onChange={(event) => onDraftChange({ note: event.target.value })}
        />
      </Field>

      <Field
        label={t('community.print.photosLabel')}
        hint={t('community.print.photosHint', { count: COMMUNITY_PRINT_MAX_PHOTOS })}
      >
        <PrintPhotoPicker
          photos={photos}
          onAdd={onAddPhoto}
          onRemove={onRemovePhoto}
          error={photoError}
          onError={onPhotoError}
          disabled={disabled}
        />
      </Field>
    </div>
  );
}
