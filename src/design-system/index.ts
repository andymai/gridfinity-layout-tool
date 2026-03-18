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

// Spinner
export { Spinner } from './Spinner';
export type { SpinnerProps } from './Spinner';

// Popover
export { Popover } from './Popover';
export type { PopoverProps } from './Popover';

// ProgressBar
export { ProgressBar } from './ProgressBar';
export type { ProgressBarProps } from './ProgressBar';

// Composite Components

// Stepper
export { Stepper } from './Stepper';
export type { StepperProps } from './Stepper';

// Collapsible
export { Collapsible } from './Collapsible';
export type { CollapsibleProps } from './Collapsible';

// Dialog (compound: Dialog.Root, Dialog.Header, Dialog.Body, Dialog.Footer) + ConfirmDialog
export { Dialog, ConfirmDialog } from './Dialog';
export type {
  DialogProps,
  DialogHeaderProps,
  DialogBodyProps,
  DialogFooterProps,
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
