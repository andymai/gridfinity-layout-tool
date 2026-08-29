/**
 * Resizable, collapsible side panel frame (compound component).
 *
 * Generalizes the cutout workspace's inspector dock: a fixed column docked to
 * one edge, drag-or-keyboard resizable on its inner edge, collapsible to a
 * thin rail, with width + collapsed state persisted per `persistKey`.
 *
 * Composition:
 *   <SidePanel.Root side="right" persistKey="…" labels={{…}} railTitle="…">
 *     <SidePanel.Header>title + actions</SidePanel.Header>
 *     …anything (e.g. a tab strip)…
 *     <SidePanel.Body>scrolling content</SidePanel.Body>
 *   </SidePanel.Root>
 *
 * The Header paints a scroll shadow once the Body has scrolled. All strings
 * arrive via the `labels` prop — the design system never translates.
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { cn } from '../cn';
import { IconButton } from '../IconButton';
import { Tooltip } from '../Tooltip';
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '../Icon';
import {
  loadPanelCollapsed,
  loadPanelWidth,
  savePanelCollapsed,
  savePanelWidth,
} from './sidePanelStorage';

export interface SidePanelLabels {
  /** Accessible label for the collapse button in the header. */
  readonly collapse: string;
  /** Accessible label for the expand button on the collapsed rail. */
  readonly expand: string;
  /** Accessible label for the resize handle. */
  readonly resize: string;
}

interface SidePanelContextValue {
  isScrolled: boolean;
  setIsScrolled: (scrolled: boolean) => void;
  toggleCollapsed: () => void;
  labels: SidePanelLabels;
  side: 'left' | 'right';
}

const SidePanelContext = createContext<SidePanelContextValue | null>(null);

function useSidePanelContext(): SidePanelContextValue {
  const context = useContext(SidePanelContext);
  if (!context) {
    throw new Error('SidePanel parts must be used within SidePanel.Root');
  }
  return context;
}

/** Width change per arrow-key press on the resize handle. */
const KEYBOARD_RESIZE_STEP = 16;

const collapseButtonClasses =
  'flex-shrink-0 rounded-md p-1.5 text-content-tertiary transition-colors hover:bg-surface-hover hover:text-content disabled:pointer-events-none disabled:opacity-40';

export interface SidePanelRootProps {
  /**
   * Which app edge the panel is docked to; the resize handle sits on the
   * opposite (inner) edge.
   * @default 'right'
   */
  side?: 'left' | 'right';
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  /**
   * localStorage key prefix for width + collapsed persistence
   * (`${persistKey}-width`, `${persistKey}-collapsed`). Omit for
   * session-only state.
   */
  persistKey?: string;
  labels: SidePanelLabels;
  /** Vertical title text shown on the collapsed rail. */
  railTitle?: string;
  /** Extra content rendered on the collapsed rail below the title. */
  railExtra?: ReactNode;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
  children: ReactNode;
}

function SidePanelRoot({
  side = 'right',
  minWidth = 220,
  maxWidth = 420,
  defaultWidth = 288,
  persistKey,
  labels,
  railTitle,
  railExtra,
  defaultCollapsed = false,
  onCollapsedChange,
  className,
  children,
}: SidePanelRootProps) {
  const [width, setWidth] = useState(() =>
    persistKey
      ? loadPanelWidth(persistKey, { min: minWidth, max: maxWidth, fallback: defaultWidth })
      : defaultWidth
  );
  const [collapsed, setCollapsed] = useState(() =>
    persistKey ? loadPanelCollapsed(persistKey, defaultCollapsed) : defaultCollapsed
  );
  const [isScrolled, setIsScrolled] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const draggingRef = useRef(false);

  const persistWidth = useCallback(
    (next: number) => {
      if (persistKey) savePanelWidth(persistKey, next);
    },
    [persistKey]
  );

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (persistKey) savePanelCollapsed(persistKey, next);
      onCollapsedChange?.(next);
      return next;
    });
  }, [persistKey, onCollapsedChange]);

  const clampWidth = useCallback(
    (v: number) => Math.max(minWidth, Math.min(maxWidth, v)),
    [minWidth, maxWidth]
  );

  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);

      const handleMove = (moveEvent: PointerEvent) => {
        if (!draggingRef.current || !panelRef.current) return;
        const rect = panelRef.current.getBoundingClientRect();
        const next =
          side === 'right' ? rect.right - moveEvent.clientX : moveEvent.clientX - rect.left;
        setWidth(clampWidth(next));
      };

      const handleUp = () => {
        draggingRef.current = false;
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);
        document.removeEventListener('pointercancel', handleUp);
        if (panelRef.current) {
          persistWidth(panelRef.current.getBoundingClientRect().width);
        }
      };

      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp);
      // Cancelled gestures (OS interruption, lost capture) must also end the drag,
      // otherwise draggingRef stays true and the panel keeps resizing on later moves.
      document.addEventListener('pointercancel', handleUp);
    },
    [side, clampWidth, persistWidth]
  );

  const handleResizeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Arrow keys move the handle in screen direction, like a window splitter:
      // the same key grows one side and shrinks the other depending on `side`.
      const growKey = side === 'right' ? 'ArrowLeft' : 'ArrowRight';
      const shrinkKey = side === 'right' ? 'ArrowRight' : 'ArrowLeft';
      let next: number | null = null;
      if (e.key === growKey) next = clampWidth(width + KEYBOARD_RESIZE_STEP);
      else if (e.key === shrinkKey) next = clampWidth(width - KEYBOARD_RESIZE_STEP);
      else if (e.key === 'Home') next = minWidth;
      else if (e.key === 'End') next = maxWidth;
      if (next !== null) {
        e.preventDefault();
        setWidth(next);
        persistWidth(next);
      }
    },
    [side, width, clampWidth, minWidth, maxWidth, persistWidth]
  );

  const borderSide = side === 'right' ? 'border-l' : 'border-r';
  const CollapseIcon = side === 'right' ? ChevronDoubleLeftIcon : ChevronDoubleRightIcon;

  if (collapsed) {
    return (
      <aside
        className={cn(
          'flex w-12 flex-shrink-0 flex-col items-center py-2',
          borderSide,
          'border-stroke-subtle bg-surface-secondary',
          className
        )}
      >
        <Tooltip content={labels.expand} placement={side === 'right' ? 'left' : 'right'}>
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            touchTarget={false}
            onClick={toggleCollapsed}
            className={collapseButtonClasses}
            aria-expanded={false}
            aria-label={labels.expand}
          >
            <CollapseIcon size="sm" />
          </IconButton>
        </Tooltip>
        {railTitle && (
          <span
            className="mt-3 text-micro font-semibold uppercase tracking-wider text-content-tertiary"
            style={{ writingMode: 'vertical-rl' }}
          >
            {railTitle}
          </span>
        )}
        {railExtra}
      </aside>
    );
  }

  return (
    <SidePanelContext.Provider value={{ isScrolled, setIsScrolled, toggleCollapsed, labels, side }}>
      <aside
        ref={panelRef}
        className={cn(
          'relative flex flex-shrink-0 flex-col overflow-hidden',
          borderSide,
          'border-stroke-subtle bg-surface-secondary',
          className
        )}
        style={{ width }}
      >
        {/* ARIA window-splitter pattern: a focusable separator IS the
            interactive element here, which jsx-a11y's heuristics don't model. */}
        {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- ARIA window-splitter: the focusable separator IS the interactive element, which these heuristics cannot model */}
        <div
          className={cn(
            'group absolute inset-y-0 z-10 w-2 cursor-col-resize select-none',
            side === 'right' ? '-left-1' : '-right-1',
            'focus-visible:outline-none'
          )}
          role="separator"
          onPointerDown={handleResizeStart}
          onKeyDown={handleResizeKeyDown}
          tabIndex={0}
          aria-orientation="vertical"
          aria-label={labels.resize}
          aria-valuenow={Math.round(width)}
          aria-valuemin={minWidth}
          aria-valuemax={maxWidth}
        >
          {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
          <div
            className={cn(
              'absolute inset-y-0 w-px bg-transparent transition-colors group-hover:bg-accent/60 group-focus-visible:bg-accent',
              side === 'right' ? 'left-1' : 'right-1'
            )}
          />
        </div>
        {children}
      </aside>
    </SidePanelContext.Provider>
  );
}

export interface SidePanelHeaderProps {
  children?: ReactNode;
  className?: string;
}

/** Header row with the collapse button; paints a shadow once the Body scrolls. */
function SidePanelHeader({ children, className }: SidePanelHeaderProps) {
  const { isScrolled, toggleCollapsed, labels, side } = useSidePanelContext();
  const CollapseIcon = side === 'right' ? ChevronDoubleRightIcon : ChevronDoubleLeftIcon;
  return (
    <div
      className={cn(
        'flex flex-shrink-0 flex-col border-b border-stroke-subtle transition-shadow duration-200',
        isScrolled && 'shadow-elevated',
        className
      )}
    >
      <div className="flex items-center gap-2 px-4 py-2">
        <Tooltip content={labels.collapse} placement="bottom">
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            touchTarget={false}
            onClick={toggleCollapsed}
            className={collapseButtonClasses}
            aria-expanded
            aria-label={labels.collapse}
          >
            <CollapseIcon size="sm" />
          </IconButton>
        </Tooltip>
        {children}
      </div>
    </div>
  );
}

export interface SidePanelBodyProps {
  children: ReactNode;
  className?: string;
}

/** The scrolling content region; drives the Header's scroll shadow. */
function SidePanelBody({ children, className }: SidePanelBodyProps) {
  const { setIsScrolled } = useSidePanelContext();
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      setIsScrolled(e.currentTarget.scrollTop > 0);
    },
    [setIsScrolled]
  );
  return (
    <div
      onScroll={handleScroll}
      className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin', className)}
    >
      {children}
    </div>
  );
}

export const SidePanel = {
  Root: SidePanelRoot,
  Header: SidePanelHeader,
  Body: SidePanelBody,
};
