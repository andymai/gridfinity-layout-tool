import { useState, useId, forwardRef, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';
import { ChevronDownIcon } from '../Icon';
import { focusRing, interactiveTransition } from '../variants';

const headerVariants = cva(['font-semibold', 'tracking-wide'], {
  variants: {
    size: {
      sm: 'text-xs text-content-tertiary uppercase tracking-wider',
      md: 'text-sm text-content-secondary',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const triggerVariants = cva(
  [
    'flex items-center gap-2',
    'bg-transparent',
    'rounded',
    'hover:opacity-80',
    interactiveTransition,
    ...focusRing,
  ],
  {
    variants: {
      size: {
        sm: 'text-xs',
        md: 'text-sm',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

type CollapsibleVariantProps = VariantProps<typeof headerVariants>;

export interface CollapsibleProps extends CollapsibleVariantProps {
  /**
   * Section title displayed in the header.
   */
  title: string;

  /**
   * Content to render inside the collapsible section.
   */
  children: ReactNode;

  /**
   * Whether section starts expanded.
   * @default true
   */
  defaultExpanded?: boolean;

  /**
   * Controlled expanded state. Use with `onExpandedChange`.
   */
  expanded?: boolean;

  /**
   * Called when expanded state changes (controlled mode).
   */
  onExpandedChange?: (expanded: boolean) => void;

  /**
   * Optional badge to show next to the title.
   * Commonly used for counts.
   */
  badge?: ReactNode;

  /**
   * Optional actions to show on the right side of header.
   * Rendered outside the toggle button for independent interaction.
   */
  actions?: ReactNode;

  /**
   * Optional icon shown before the title.
   */
  icon?: ReactNode;

  /**
   * Optional summary shown when collapsed.
   * Use for a preview of the content (e.g., "2×2×3u").
   */
  summary?: ReactNode;

  /**
   * Additional CSS classes for the container.
   */
  className?: string;
}

/**
 * Collapsible section with animated expand/collapse.
 *
 * Commonly used for sidebar panels to save vertical space.
 * Supports both controlled and uncontrolled modes.
 *
 * @example
 * // Basic usage (uncontrolled)
 * <Collapsible title="Settings">
 *   <SettingsContent />
 * </Collapsible>
 *
 * @example
 * // With badge and actions
 * <Collapsible
 *   title="Categories"
 *   badge={<Badge>5</Badge>}
 *   actions={<Button size="sm" iconOnly><PlusIcon /></Button>}
 * >
 *   <CategoryList />
 * </Collapsible>
 *
 * @example
 * // With summary preview
 * <Collapsible
 *   title="Dimensions"
 *   summary="2×2×3u"
 *   icon={<CubeIcon />}
 * >
 *   <DimensionControls />
 * </Collapsible>
 *
 * @example
 * // Controlled mode
 * <Collapsible
 *   title="Advanced"
 *   expanded={showAdvanced}
 *   onExpandedChange={setShowAdvanced}
 * >
 *   <AdvancedSettings />
 * </Collapsible>
 *
 * @example
 * // Small variant (for nested sections)
 * <Collapsible title="OPTIONS" size="sm">
 *   <Options />
 * </Collapsible>
 */
export const Collapsible = forwardRef<HTMLDivElement, CollapsibleProps>(
  (
    {
      title,
      children,
      defaultExpanded = true,
      expanded: controlledExpanded,
      onExpandedChange,
      badge,
      actions,
      icon,
      summary,
      size = 'md',
      className,
    },
    ref
  ) => {
    // Track internal state for uncontrolled mode
    const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);

    // Determine if controlled or uncontrolled
    const isControlled = controlledExpanded !== undefined;
    const expanded = isControlled ? controlledExpanded : uncontrolledExpanded;

    // Track if user has toggled - only animate after first interaction to prevent CLS
    const [hasToggled, setHasToggled] = useState(false);

    const contentId = useId();
    const triggerId = useId();

    const handleToggle = () => {
      setHasToggled(true);
      const newValue = !expanded;

      if (isControlled) {
        onExpandedChange?.(newValue);
      } else {
        setUncontrolledExpanded(newValue);
      }
    };

    const hasIcon = icon !== undefined;

    return (
      <div ref={ref} className={className}>
        {/* Header row */}
        <div className="flex items-center justify-between">
          <button
            id={triggerId}
            type="button"
            className={triggerVariants({ size })}
            onClick={handleToggle}
            aria-expanded={expanded}
            aria-controls={contentId}
          >
            <ChevronDownIcon
              size="xs"
              className={cn(
                'text-content-tertiary transition-transform duration-200',
                expanded ? 'rotate-0' : '-rotate-90'
              )}
              aria-hidden="true"
            />
            {icon && (
              <span className="flex-shrink-0 text-content-tertiary" aria-hidden="true">
                {icon}
              </span>
            )}
            <span className={headerVariants({ size })}>{title}</span>
            {badge}
          </button>
          {actions}
        </div>

        {/* Summary (shown when collapsed) */}
        {summary && !expanded && (
          <div
            className={cn(
              'mt-1 text-xs text-content-tertiary truncate',
              hasIcon ? 'ml-[38px]' : 'ml-[22px]'
            )}
            aria-hidden="true"
          >
            {summary}
          </div>
        )}

        {/* Content region */}
        <div
          id={contentId}
          role="region"
          aria-labelledby={triggerId}
          aria-hidden={!expanded}
          className={cn(
            'overflow-hidden',
            hasToggled && 'transition-all duration-200',
            expanded ? 'opacity-100 max-h-[2000px] mt-3' : 'opacity-0 max-h-0'
          )}
        >
          {children}
        </div>
      </div>
    );
  }
);

Collapsible.displayName = 'Collapsible';
