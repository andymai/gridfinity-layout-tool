/**
 * Gridfinity Layout Tool Design System
 *
 * A comprehensive component library built with:
 * - TypeScript for maximum type safety
 * - CVA (class-variance-authority) for variant management
 * - Tailwind CSS for styling
 * - Full accessibility (WCAG 2.1 AA compliant)
 *
 * @example
 * import { Button, Dialog, Stepper } from '@/design-system';
 *
 * @see docs/README.md for complete documentation
 */

// Utilities
export { cn } from './cn';

// Shared Variants
export {
  // Type scales
  sizeScale,
  variantScale,
  intentScale,
  // Shared class compositions
  focusRing,
  disabledStyles,
  interactiveTransition,
  activePress,
  touchTarget,
  // Size mappings
  sizeHeights,
  sizePaddings,
  sizeText,
  sizeGaps,
  iconSizes,
  // Variant mappings
  variantColors,
  intentBackgrounds,
  intentText,
} from './variants';

export type { Size, Variant, Intent } from './variants';

// Primitive Components

// Button
export { Button } from './Button';
export type { ButtonProps } from './Button';

// Checkbox
export { Checkbox } from './Checkbox';
export type { CheckboxProps } from './Checkbox';

// Input
export { Input } from './Input';
export type { InputProps } from './Input';

// Select
export { Select } from './Select';
export type { SelectProps, SelectOption } from './Select';

// Switch
export { Switch } from './Switch';
export type { SwitchProps } from './Switch';

// Spinner
export { Spinner } from './Spinner';
export type { SpinnerProps } from './Spinner';

// Popover
export { Popover } from './Popover';
export type { PopoverProps } from './Popover';

// ProgressBar
export { ProgressBar } from './ProgressBar';
export type { ProgressBarProps } from './ProgressBar';

// Slider
export { Slider } from './Slider';
export type { SliderProps } from './Slider';

// SliderInput (label + slider + editable value badge)
export { SliderInput } from './SliderInput';
export type { SliderInputProps } from './SliderInput';

// IconButton
export { IconButton } from './IconButton';
export type { IconButtonProps } from './IconButton';

// Tooltip
export { Tooltip } from './Tooltip';
export type { TooltipProps } from './Tooltip';

// Card
export { Card } from './Card';
export type { CardProps } from './Card';

// Badge
export { Badge } from './Badge';
export type { BadgeProps } from './Badge';

// SegmentedControl
export { SegmentedControl } from './SegmentedControl';
export type { SegmentedControlProps, SegmentedControlOption } from './SegmentedControl';

// Alert
export { Alert } from './Alert';
export type { AlertProps } from './Alert';

// Kbd
export { Kbd } from './Kbd';
export type { KbdProps } from './Kbd';

// Textarea
export { Textarea } from './Textarea';
export type { TextareaProps } from './Textarea';

// ColorSwatch
export { ColorSwatch } from './ColorSwatch';
export type { ColorSwatchProps } from './ColorSwatch';

// Composite Components

// Stepper
export { Stepper } from './Stepper';
export type { StepperProps } from './Stepper';

// Collapsible
export { Collapsible } from './Collapsible';
export type { CollapsibleProps } from './Collapsible';

// Field
export { Field } from './Field';
export type { FieldProps } from './Field';

// EmptyState
export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

// Tabs (compound: Tabs.Root, Tabs.List, Tabs.Panel)
export { Tabs } from './Tabs';
export type { TabItem, TabsListProps, TabsPanelProps, TabsRootProps } from './Tabs';

// CopyButton + CopyField
export { CopyButton, CopyField } from './CopyButton';
export type { CopyButtonProps, CopyFieldProps } from './CopyButton';

// NavRow
export { NavRow } from './NavRow';
export type { NavRowProps } from './NavRow';

// InlineEditText
export { InlineEditText } from './InlineEditText';
export type { InlineEditTextProps } from './InlineEditText';

// CheckboxRow
export { CheckboxRow } from './CheckboxRow';
export type { CheckboxRowProps } from './CheckboxRow';

// Dialog (compound: Root, Header, SubHeader, Body, Split, Sidebar, Pane, Footer) + ConfirmDialog + overlay behavior hooks
export {
  Dialog,
  ConfirmDialog,
  useFocusTrap,
  useBodyScrollLock,
  useDialogStack,
  registerDialog,
  unregisterDialog,
  isTopmostDialog,
} from './Dialog';
export type {
  DialogProps,
  DialogHeaderProps,
  DialogSubHeaderProps,
  DialogBodyProps,
  DialogSplitProps,
  DialogSidebarProps,
  DialogPaneProps,
  DialogFooterProps,
  DialogInitialFocus,
  ConfirmDialogProps,
} from './Dialog';

// Menu (compound: Menu.Root, Menu.Item, Menu.Divider)
export { Menu } from './Menu';
export type { MenuProps, MenuItemProps } from './Menu';

// Toast
export { ToastContainer } from './Toast';
export type { ToastContainerProps, ToastData, ToastType } from './Toast';

// Icons
export {
  // Base icon component
  Icon,
  // Individual icons
  ArrowLeftIcon,
  ChevronDownIcon,
  CheckIcon,
  Grid3x3Icon,
  InfoIcon,
  LayoutGridIcon,
  MagnetIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  TrashIcon,
  AlertTriangleIcon,
  XIcon,
} from './Icon';

export type {
  IconProps,
  ArrowLeftIconProps,
  ChevronDownIconProps,
  CheckIconProps,
  Grid3x3IconProps,
  InfoIconProps,
  LayoutGridIconProps,
  MagnetIconProps,
  MinusIconProps,
  PlusIconProps,
  RotateCcwIconProps,
  SearchIconProps,
  TrashIconProps,
  AlertTriangleIconProps,
  XIconProps,
} from './Icon';
