import { useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSettingsStore } from '../store';
import { useContextMenu } from '../hooks/useContextMenu';
import { ContextMenuContainer, ContextMenuItem } from './ContextMenu';
import { openSTLSearch, formatDimension } from '../utils/stlSearch';
import type { STLSearchSite } from '../store/settings';

interface STLSearchDropdownProps {
  /** Bin width in grid units */
  width: number;
  /** Bin depth in grid units */
  depth: number;
  /**
   * Variant styling:
   * - 'button': Text button with icon (for inspector)
   * - 'icon': Icon-only button (for table rows)
   * - 'menu-item': Full-width menu item style (for context menu)
   */
  variant?: 'button' | 'icon' | 'menu-item';
  /** Additional CSS classes for the trigger */
  className?: string;
  /** Callback when dropdown closes (useful for closing parent context menu) */
  onClose?: () => void;
  /** If true, searches for "gridfinity split" instead of dimensions */
  needsSplit?: boolean;
}

/**
 * Dropdown menu for searching STL files by bin dimensions.
 * Displays enabled search sites from user settings.
 *
 * @example In SingleBinInspector
 * ```tsx
 * <STLSearchDropdown width={bin.width} depth={bin.depth} variant="button" />
 * ```
 *
 * @example In BinListTable
 * ```tsx
 * <STLSearchDropdown width={2} depth={3} variant="icon" />
 * ```
 *
 * @example In BinContextMenu
 * ```tsx
 * <STLSearchDropdown width={bin.width} depth={bin.depth} variant="menu-item" onClose={closeMenu} />
 * ```
 */
export function STLSearchDropdown({
  width,
  depth,
  variant = 'button',
  className = '',
  onClose,
  needsSplit = false,
}: STLSearchDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { isOpen, position, show, hide, menuRef } = useContextMenu();

  // Get all sites and filter in useMemo to avoid infinite re-renders
  const stlSearchSites = useSettingsStore((state) => state.settings.stlSearchSites);
  const enabledSites = useMemo(
    () => stlSearchSites.filter((s) => s.enabled),
    [stlSearchSites]
  );

  // Single site mode - no dropdown needed
  const isSingleSite = enabledSites.length === 1;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // Single site: open directly
      if (isSingleSite) {
        openSTLSearch(enabledSites[0], { width, depth }, needsSplit);
        onClose?.();
        return;
      }

      // Multiple sites: toggle dropdown
      if (isOpen) {
        hide();
      } else {
        const button = triggerRef.current;
        if (button) {
          const rect = button.getBoundingClientRect();
          const menuWidth = 200;
          const menuHeight = 200;

          // Calculate position, keeping menu within viewport
          let x = rect.left;
          let y = rect.bottom + 4;

          // Adjust horizontal position if menu would overflow right edge
          if (x + menuWidth > window.innerWidth - 8) {
            x = Math.max(8, window.innerWidth - menuWidth - 8);
          }

          // Open above if not enough space below
          if (y + menuHeight > window.innerHeight - 8) {
            y = rect.top - menuHeight - 4;
          }

          show({ x, y });
        }
      }
    },
    [isSingleSite, enabledSites, width, depth, needsSplit, onClose, isOpen, show, hide]
  );

  const handleSiteClick = useCallback(
    (site: STLSearchSite) => {
      openSTLSearch(site, { width, depth }, needsSplit);
      hide();
      onClose?.();
    },
    [width, depth, needsSplit, hide, onClose]
  );

  const handleClose = useCallback(() => {
    hide();
  }, [hide]);

  const sizeLabel = `${formatDimension(width)}x${formatDimension(depth)}`;
  const isDisabled = enabledSites.length === 0;

  // Build descriptive tooltip for icon variant (memoized to avoid array ops on every render)
  const iconTooltip = useMemo(
    () =>
      isSingleSite
        ? `Search ${enabledSites[0].name} for ${sizeLabel}`
        : `Find STL for ${sizeLabel} (${enabledSites.map((s) => s.name).join(', ')})`,
    [isSingleSite, enabledSites, sizeLabel]
  );

  // Don't render anything if no sites are enabled
  if (isDisabled) {
    return null;
  }

  return (
    <>
      {/* Trigger button */}
      {variant === 'button' && (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleClick}
          className={`btn btn-ghost gap-1.5 text-content-secondary hover:text-content ${className}`}
          aria-label={`Find STL for ${sizeLabel} bin`}
          aria-expanded={isSingleSite ? undefined : isOpen}
          aria-haspopup={isSingleSite ? undefined : 'menu'}
        >
          <SearchIcon className="w-4 h-4" />
          {isSingleSite ? `Search ${enabledSites[0].name}` : 'Find STL'}
          {!isSingleSite && <ChevronIcon className="w-3 h-3" isOpen={isOpen} />}
        </button>
      )}

      {variant === 'icon' && (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleClick}
          className={`btn btn-ghost p-1.5 text-content-tertiary hover:text-content ${className}`}
          aria-label={iconTooltip}
          aria-expanded={isSingleSite ? undefined : isOpen}
          aria-haspopup={isSingleSite ? undefined : 'menu'}
          title={iconTooltip}
        >
          <SearchIcon className="w-4 h-4" />
        </button>
      )}

      {variant === 'menu-item' && (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleClick}
          className={`w-full px-4 py-3 flex items-center gap-3 text-content hover:bg-surface-hover ${className}`}
          aria-label={`Find STL for ${sizeLabel} bin`}
          aria-expanded={isSingleSite ? undefined : isOpen}
          aria-haspopup={isSingleSite ? undefined : 'menu'}
        >
          <SearchIcon className="w-5 h-5 text-content-tertiary flex-shrink-0" />
          <span className="flex-1 text-left">{isSingleSite ? `Search ${enabledSites[0].name}` : 'Find STL'}</span>
          {!isSingleSite && <ChevronRightIcon className="w-4 h-4 text-content-tertiary flex-shrink-0" />}
        </button>
      )}

      {/* Dropdown menu - portaled to escape BottomSheet transforms on mobile */}
      {!isSingleSite && createPortal(
        <ContextMenuContainer
          isOpen={isOpen}
          position={position}
          onClose={handleClose}
          menuRef={menuRef}
        >
          {/* Header */}
          <div className="px-4 py-2 border-b border-stroke-subtle">
            <div className="text-xs text-content-tertiary">
              {needsSplit
                ? 'Search for split bin generators'
                : `Search for ${sizeLabel} bins`}
            </div>
          </div>

          {/* Site options */}
          <div className="py-1">
            {enabledSites.map((site) => (
              <ContextMenuItem
                key={site.id}
                icon={<ExternalLinkIcon className="w-4 h-4" />}
                label={site.name}
                onClick={() => handleSiteClick(site)}
              />
            ))}
          </div>
        </ContextMenuContainer>,
        document.body
      )}
    </>
  );
}

// ============================================================================
// Icons (inline to avoid adding dependencies)
// ============================================================================

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function ChevronIcon({ className, isOpen }: { className?: string; isOpen: boolean }) {
  return (
    <svg
      className={`${className} transition-transform ${isOpen ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}
