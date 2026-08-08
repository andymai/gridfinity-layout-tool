import { useCallback, useRef, useState } from 'react';
import { Button, IconButton, Spinner, cn } from '@/design-system';
import { XIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { isErr } from '@/core/result';
import { COMMUNITY_PRINT_MAX_PHOTOS } from '@/shared/types/communityPrint';
import type { PrintPhotoSlot } from '../../store/printDialogStore';
import { preparePrintPhoto } from '../../utils/printPhoto';
import type { PrintPhotoError } from '../../utils/printPhoto';

const PHOTO_ERROR_KEYS: Record<PrintPhotoError['kind'], string> = {
  notAnImage: 'community.print.photoError.notAnImage',
  sourceTooLarge: 'community.print.photoError.sourceTooLarge',
  decodeFailed: 'community.print.photoError.decodeFailed',
  encodeFailed: 'community.print.photoError.encodeFailed',
  irreducible: 'community.print.photoError.irreducible',
};

export interface PrintPhotoPickerProps {
  photos: readonly PrintPhotoSlot[];
  onAdd: (dataUrl: string, thumbDataUrl: string | null) => void;
  onRemove: (index: number) => void;
  error: string | null;
  onError: (message: string | null) => void;
  disabled?: boolean;
}

export function PrintPhotoPicker({
  photos,
  onAdd,
  onRemove,
  error,
  onError,
  disabled = false,
}: PrintPhotoPickerProps) {
  const t = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const full = photos.length >= COMMUNITY_PRINT_MAX_PHOTOS;

  const handleFiles = useCallback(
    async (files: FileList) => {
      setBusy(true);
      onError(null);
      try {
        // Bounded by the remaining slots rather than the selection: a picker
        // that lets someone choose six photos should take the first few and
        // say so, not fail the whole batch.
        const room = COMMUNITY_PRINT_MAX_PHOTOS - photos.length;
        for (const file of Array.from(files).slice(0, room)) {
          const result = await preparePrintPhoto(file);
          if (isErr(result)) {
            onError(t(PHOTO_ERROR_KEYS[result.error.kind]));
            return;
          }
          onAdd(result.value.dataUrl, result.value.thumbDataUrl);
        }
      } finally {
        setBusy(false);
      }
    },
    [onAdd, onError, photos.length, t]
  );

  return (
    <div className="space-y-2" data-testid="print-photo-picker">
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <div
            key={photo.url}
            className="relative h-20 w-20 overflow-hidden rounded-lg border border-stroke-subtle bg-surface-secondary"
          >
            <img src={photo.url} alt="" className="h-full w-full object-cover" />
            <IconButton
              aria-label={t('community.print.removePhoto', { index: index + 1 })}
              size="sm"
              disabled={disabled}
              onClick={() => onRemove(index)}
              className="absolute right-0.5 top-0.5 bg-surface/80 backdrop-blur-sm"
              data-testid={`print-photo-remove-${index}`}
            >
              <XIcon className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        ))}

        {!full && (
          <Button
            variant="secondary"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            className={cn('h-20 w-20 flex-col gap-1 text-xs', busy && 'pointer-events-none')}
            data-testid="print-photo-add"
          >
            {busy ? <Spinner size="sm" /> : <span aria-hidden="true">+</span>}
            <span>
              {busy ? t('community.print.photoPreparing') : t('community.print.addPhoto')}
            </span>
          </Button>
        )}
      </div>

      {/* Hidden from AT and from the tab order on purpose: the labelled button
          above is the real control, and an sr-only input would otherwise be a
          focusable, unnamed file field that ignores the disabled state. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled || busy}
        // Reset the value after handling so re-picking the same file still
        // fires a change event.
        onChange={(event) => {
          const { files } = event.target;
          if (files !== null && files.length > 0) void handleFiles(files);
          event.target.value = '';
        }}
        data-testid="print-photo-input"
      />

      {error !== null && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}
