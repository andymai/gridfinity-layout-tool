/* eslint-disable react-refresh/only-export-components -- ICON_PATHS is a const map shared with sibling components in this folder; co-locating it with the SvgIcon consumer keeps the icon set discoverable */

/**
 * Stateless presentational pieces shared by the mobile layouts panel:
 * iconography, the bottom action sheet, swipe-action and share-option
 * buttons, the row-of-three action bar shown for the active layout, the
 * loading spinner, and the share-permission select.
 */

import { createPortal } from 'react-dom';
import { Button, IconButton, Select } from '@/design-system';
import type { SelectOption } from '@/design-system';
import type { SharePermission } from '@/core/types';
import { useTranslation } from '@/i18n';

export const ICON_PATHS = {
  rename:
    'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  share:
    'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
  duplicate:
    'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  delete:
    'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  cloud: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
  link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  download:
    'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  grid: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z',
  chevronLeft: 'M15 19l-7-7 7-7',
  chevronRight: 'M9 5l7 7-7 7',
  plus: 'M12 4v16m8-8H4',
  close: 'M6 18L18 6M6 6l12 12',
  check: 'M5 13l4 4L19 7',
} as const;

interface SvgIconProps {
  readonly path: string;
  readonly className?: string;
}

export function SvgIcon({ path, className = 'w-5 h-5' }: SvgIconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  );
}

interface ActionSheetProps {
  readonly onClose: () => void;
  readonly children: React.ReactNode;
}

export function ActionSheet({ onClose, children }: ActionSheetProps) {
  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-end"
      onClick={onClose}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation prevents backdrop dismiss */}
      <div
        className="bg-surface-elevated w-full rounded-t-2xl p-4 pb-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="w-10 h-1 bg-content-disabled rounded-full mx-auto mb-4" />
        {children}
      </div>
    </div>,
    document.body
  );
}

interface ShareOptionButtonProps {
  readonly onClick: () => void;
  readonly iconPath: string;
  readonly iconColor: string;
  readonly bgColor: string;
  readonly title: string;
  readonly description: string;
}

export function ShareOptionButton({
  onClick,
  iconPath,
  iconColor,
  bgColor,
  title,
  description,
}: ShareOptionButtonProps) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 bg-surface rounded-lg active:bg-surface-hover"
    >
      <div className={`w-10 h-10 ${bgColor} rounded-full flex items-center justify-center`}>
        <SvgIcon path={iconPath} className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="text-left">
        <div className="font-medium text-content">{title}</div>
        <div className="text-sm font-normal text-content-secondary">{description}</div>
      </div>
    </Button>
  );
}

type SwipeActionBgColor = 'bg-warning' | 'bg-success' | 'bg-accent' | 'bg-danger';

/**
 * Literal `hover:` overrides for each swipe-action badge color.
 *
 * `IconButton variant="ghost"` injects `hover:bg-surface-hover hover:text-content`,
 * which would replace the colored badge and its icon color on hover. We re-assert
 * the badge color with matching literal hover classes so the badge keeps its color
 * (the original raw button element had no hover treatment). Tailwind's JIT only compiles
 * literal class strings, so these must stay literal — never `hover:${bgColor}`.
 */
const SWIPE_HOVER_BG: Record<SwipeActionBgColor, string> = {
  'bg-warning': 'hover:bg-warning',
  'bg-success': 'hover:bg-success',
  'bg-accent': 'hover:bg-accent',
  'bg-danger': 'hover:bg-danger',
};

interface SwipeActionButtonProps {
  readonly onClick: () => void;
  readonly iconPath: string;
  readonly bgColor: SwipeActionBgColor;
  readonly label: string;
  readonly disabled?: boolean;
}

export function SwipeActionButton({
  onClick,
  iconPath,
  bgColor,
  label,
  disabled,
}: SwipeActionButtonProps) {
  return (
    <IconButton
      variant="ghost"
      onClick={onClick}
      className={`w-15 h-full rounded-none ${bgColor} ${SWIPE_HOVER_BG[bgColor]} text-on-dark hover:text-on-dark`}
      aria-label={label}
      disabled={disabled}
    >
      <SvgIcon path={iconPath} />
    </IconButton>
  );
}

interface ActiveLayoutActionsProps {
  readonly entryId: string;
  readonly onRename: (id: string) => void;
  readonly onShare: (id: string) => void;
  readonly onDuplicate: (id: string) => void;
}

export function ActiveLayoutActions({
  entryId,
  onRename,
  onShare,
  onDuplicate,
}: ActiveLayoutActionsProps) {
  const t = useTranslation();

  const actions = [
    { handler: onRename, icon: ICON_PATHS.rename, label: t('common.rename') },
    { handler: onShare, icon: ICON_PATHS.share, label: t('common.share') },
    { handler: onDuplicate, icon: ICON_PATHS.duplicate, label: t('common.duplicate') },
  ] as const;

  return (
    <div className="flex items-center gap-2 px-4 pb-4">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="secondary"
          onClick={() => action.handler(entryId)}
          className="flex-1 h-11"
        >
          <SvgIcon path={action.icon} className="w-4 h-4 mr-1.5" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}

export function LoadingSpinner({ label }: { readonly label: string }) {
  return (
    <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-content-secondary">
        <svg
          className="w-5 h-5 animate-spin motion-reduce:animate-none"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span>{label}</span>
      </div>
    </div>
  );
}

interface PermissionSelectProps {
  readonly value: SharePermission;
  readonly onChange: (value: SharePermission) => void;
  readonly id?: string;
  readonly ariaLabel?: string;
  readonly className?: string;
}

export function PermissionSelect({
  value,
  onChange,
  id,
  ariaLabel,
  className,
}: PermissionSelectProps) {
  const t = useTranslation();
  const options: SelectOption[] = [
    { id: 'view', name: t('mobile.layouts.anyoneCanView') },
    { id: 'edit', name: t('mobile.layouts.anyoneCanEdit') },
  ];
  return (
    <Select
      fullWidth
      id={id}
      value={value}
      onValueChange={(v) => onChange(v as SharePermission)}
      options={options}
      className={className}
      aria-label={ariaLabel}
    />
  );
}
