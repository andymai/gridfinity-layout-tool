import { useLayoutEffect, type ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../cn';
import { Button } from '../Button';
import { XIcon } from '../Icon';
import { DialogRoot, useDialogContext } from './DialogRoot';

const headerVariants = cva(['flex items-center justify-between gap-3', 'flex-shrink-0'], {
  variants: {
    density: {
      default: 'px-[var(--space-2xl)] pt-[var(--space-2xl)]',
      // No bottom inset by design: this density exists for a header whose
      // trailing slot is a tab row, and a tab underline only reads as one
      // when it sits on the header's own border. The side inset yields on a
      // phone, where the title and the tabs are competing for the width.
      compact: 'px-4 pt-2 md:px-[var(--space-2xl)]',
    },
    bordered: {
      true: 'border-b border-stroke-subtle',
      false: '',
    },
  },
  compoundVariants: [
    { density: 'default', bordered: false, class: 'pb-2' },
    { density: 'default', bordered: true, class: 'pb-4' },
  ],
  defaultVariants: {
    density: 'default',
    bordered: false,
  },
});

const subHeaderVariants = cva([
  'px-[var(--space-2xl)] py-3',
  'border-b border-stroke-subtle',
  'flex-shrink-0',
]);

const bodyVariants = cva(['flex-1'], {
  variants: {
    padding: {
      default: 'px-[var(--space-2xl)] py-0',
      none: 'p-0',
    },
    scroll: {
      true: 'overflow-y-auto',
      false: 'min-h-0 overflow-hidden flex flex-col',
    },
  },
  defaultVariants: {
    padding: 'default',
    scroll: true,
  },
});

const footerVariants = cva(
  ['flex items-center gap-3', 'px-[var(--space-2xl)] pt-6 pb-[var(--space-2xl)]', 'flex-shrink-0'],
  {
    variants: {
      justify: {
        end: 'justify-end',
        between: 'justify-between',
      },
      bordered: {
        true: 'border-t border-stroke-subtle',
      },
    },
    defaultVariants: {
      justify: 'end',
    },
  }
);

const splitVariants = cva(['flex flex-row max-md:flex-col', 'flex-1 min-h-0']);

const sidebarVariants = cva(['flex-shrink-0', 'border-r border-stroke-subtle', 'overflow-y-auto'], {
  variants: {
    width: {
      sm: 'w-40',
      md: 'w-64',
    },
  },
  defaultVariants: {
    width: 'md',
  },
});

const paneVariants = cva(['flex-1', 'overflow-y-auto', 'p-[var(--space-2xl)]']);

export interface DialogHeaderProps {
  /**
   * Dialog title. When omitted, provide `aria-label` on Dialog.Root.
   */
  title?: ReactNode;

  /**
   * Leading slot before the title (e.g. a back button or icon).
   */
  leading?: ReactNode;

  /**
   * Renders a bottom border under the header.
   * @default false
   */
  bordered?: boolean;

  /**
   * `compact` shrinks the title and drops the bottom inset, for a header that
   * carries a tab row in its trailing slot instead of standing alone above
   * one. Saves the height a separate SubHeader row would have cost.
   * @default 'default'
   */
  density?: 'default' | 'compact';

  /**
   * Whether to show the close button.
   * @default true
   */
  showCloseButton?: boolean;

  /**
   * Aria-label for the close button. Pass a translated string when available.
   * @default 'Close dialog'
   */
  closeAriaLabel?: string;

  /**
   * Trailing actions slot, rendered before the close button.
   */
  children?: ReactNode;
}

export function DialogHeader({
  title,
  leading,
  bordered = false,
  density = 'default',
  showCloseButton = true,
  closeAriaLabel = 'Close dialog',
  children,
}: DialogHeaderProps) {
  const { titleId, onClose, dismissable, registerTitle } = useDialogContext();

  const hasTitle = title !== undefined && title !== null;

  // useLayoutEffect so aria-labelledby is wired before first paint.
  useLayoutEffect(() => {
    if (!hasTitle) return;
    return registerTitle();
  }, [hasTitle, registerTitle]);

  return (
    <div className={headerVariants({ bordered, density })}>
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        {hasTitle && (
          <h2
            id={titleId}
            className={cn(
              'font-semibold text-content',
              density === 'compact' ? 'truncate text-title' : 'text-page'
            )}
          >
            {title}
          </h2>
        )}
      </div>
      <div className="flex items-center gap-2">
        {children}
        {showCloseButton && (
          <Button
            iconOnly
            size="sm"
            variant="ghost"
            onClick={onClose}
            disabled={!dismissable}
            aria-label={closeAriaLabel}
          >
            <XIcon size="sm" />
          </Button>
        )}
      </div>
    </div>
  );
}

export interface DialogSubHeaderProps {
  /**
   * Row content, e.g. a tab bar or search input under the title.
   */
  children: ReactNode;
  className?: string;
}

export function DialogSubHeader({ children, className }: DialogSubHeaderProps) {
  return <div className={cn(subHeaderVariants(), className)}>{children}</div>;
}

export interface DialogBodyProps {
  children: ReactNode;
  className?: string;

  /**
   * Built-in horizontal padding, or none when the content owns its padding.
   * @default 'default'
   */
  padding?: 'default' | 'none';

  /**
   * Scrollable body. When false the body becomes an overflow-hidden flex
   * column so a child (textarea, grid) can flex and scroll itself.
   * @default true
   */
  scroll?: boolean;
}

export function DialogBody({
  children,
  className,
  padding = 'default',
  scroll = true,
}: DialogBodyProps) {
  const { descriptionId, registerDescription, hasFooter } = useDialogContext();

  // useLayoutEffect so aria-describedby is wired before first paint.
  useLayoutEffect(() => registerDescription(), [registerDescription]);

  return (
    <div
      id={descriptionId}
      className={cn(
        bodyVariants({ padding, scroll }),
        // The body has no vertical padding of its own: the header's bottom
        // inset and the footer's top inset bracket it. Without a footer the
        // bottom one never arrives and the last control sits on the dialog's
        // edge, so supply it here. `padding="none"` bodies own their insets.
        !hasFooter && padding !== 'none' && 'pb-[var(--space-2xl)]',
        className
      )}
    >
      {children}
    </div>
  );
}

// Dialog Split / Sidebar / Pane

export interface DialogSplitProps {
  /**
   * Two-column content, typically a Dialog.Sidebar followed by Dialog.Pane(s).
   * Stacks vertically below the MD breakpoint.
   */
  children: ReactNode;
  className?: string;
}

export function DialogSplit({ children, className }: DialogSplitProps) {
  return <div className={cn(splitVariants(), className)}>{children}</div>;
}

export interface DialogSidebarProps {
  children: ReactNode;
  className?: string;

  /**
   * Rail width.
   * @default 'md'
   */
  width?: 'sm' | 'md';
}

export function DialogSidebar({ children, className, width = 'md' }: DialogSidebarProps) {
  return <div className={cn(sidebarVariants({ width }), className)}>{children}</div>;
}

export interface DialogPaneProps {
  children: ReactNode;
  className?: string;
}

export function DialogPane({ children, className }: DialogPaneProps) {
  return <div className={cn(paneVariants(), className)}>{children}</div>;
}

export interface DialogFooterProps {
  children: ReactNode;
  className?: string;

  /**
   * Horizontal alignment of the footer actions.
   * @default 'end'
   */
  justify?: 'end' | 'between';

  /**
   * Renders a top border above the footer.
   * @default false
   */
  bordered?: boolean;

  /**
   * Leading slot pushed to the start (e.g. a warning line or legal links).
   */
  leading?: ReactNode;
}

export function DialogFooter({
  children,
  className,
  justify = 'end',
  bordered = false,
  leading,
}: DialogFooterProps) {
  const { registerFooter } = useDialogContext();

  // useLayoutEffect so the body's fallback bottom inset resolves before first
  // paint, rather than as a visible reflow.
  useLayoutEffect(() => registerFooter(), [registerFooter]);

  return (
    <div className={cn(footerVariants({ justify, bordered }), className)}>
      {leading && <div className="mr-auto flex items-center gap-3">{leading}</div>}
      {children}
    </div>
  );
}

// Compound Component Export

export const Dialog = {
  Root: DialogRoot,
  Header: DialogHeader,
  SubHeader: DialogSubHeader,
  Body: DialogBody,
  Split: DialogSplit,
  Sidebar: DialogSidebar,
  Pane: DialogPane,
  Footer: DialogFooter,
};
