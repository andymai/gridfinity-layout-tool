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
  controlHeights,
  controlRow,
  hairline,
  // Size mappings
  sizeHeights,
  sizePaddings,
  sizeText,
  sizeGaps,
  iconSizes,
  // Typography roles
  typeRamp,
  // Variant mappings
  variantColors,
  intentBackgrounds,
  intentText,
} from './variants';

export type { Size, Variant, Intent, TypeRole } from './variants';

// Primitive Components

export { Button } from './Button';
export type { ButtonProps } from './Button';

export { Checkbox } from './Checkbox';
export type { CheckboxProps } from './Checkbox';

export { Input } from './Input';
export type { InputProps } from './Input';

export { Select } from './Select';
export type { SelectProps, SelectOption } from './Select';

// Combobox (text input + ranked suggestion dropdown + inline ghost completion)
export { Combobox } from './Combobox';
export type { ComboboxProps, ComboboxOption, ComboboxGhost } from './Combobox';

export { Switch } from './Switch';
export type { SwitchProps } from './Switch';

export { Spinner } from './Spinner';
export type { SpinnerProps } from './Spinner';

export { Popover } from './Popover';
export type { PopoverProps } from './Popover';

export { ProgressBar } from './ProgressBar';
export type { ProgressBarProps } from './ProgressBar';

export { Slider } from './Slider';
export type { SliderProps } from './Slider';

// RangeSlider (two-thumb selection over a discrete stop list)
export { RangeSlider } from './RangeSlider';
export type { RangeSliderProps, RangeValue } from './RangeSlider';

// SliderInput (label + slider + editable value badge)
export { SliderInput } from './SliderInput';
export type { SliderInputProps } from './SliderInput';
export { EditableValueBadge } from './SliderInput';
export type { EditableValueBadgeProps } from './SliderInput';

export { IconButton } from './IconButton';
export type { IconButtonProps } from './IconButton';

export { Tooltip } from './Tooltip';
export type { TooltipProps } from './Tooltip';

export { Card } from './Card';
export type { CardProps } from './Card';

export { Badge } from './Badge';
export type { BadgeProps } from './Badge';

export { SegmentedControl } from './SegmentedControl';
export type { SegmentedControlProps, SegmentedControlOption } from './SegmentedControl';

export { Alert } from './Alert';
export type { AlertProps } from './Alert';

export { Kbd } from './Kbd';
export type { KbdProps } from './Kbd';

export { Textarea } from './Textarea';
export type { TextareaProps } from './Textarea';

export { ColorSwatch } from './ColorSwatch';
export type { ColorSwatchProps } from './ColorSwatch';

// Composite Components

export { Stepper } from './Stepper';
export type { StepperProps } from './Stepper';

// NumberField (compact scrub/type/nudge numeric input with expression entry)
export { NumberField, evaluateNumberExpression } from './NumberField';
export type { NumberFieldProps } from './NumberField';

// SidePanel (resizable, collapsible docked column: Root, Header, Body)
export { SidePanel, loadPanelCollapsed, loadPanelWidth } from './SidePanel';
export type {
  SidePanelRootProps,
  SidePanelHeaderProps,
  SidePanelBodyProps,
  SidePanelLabels,
} from './SidePanel';

// SearchInput (Input preset: magnifier, clear affordance, shortcut hint)
export { SearchInput } from './SearchInput';
export type { SearchInputProps } from './SearchInput';

export { Collapsible } from './Collapsible';
export type { CollapsibleProps } from './Collapsible';

export { Field } from './Field';
export type { FieldProps } from './Field';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

// Tabs (compound: Tabs.Root, Tabs.List, Tabs.Panel)
export { Tabs } from './Tabs';
export type { TabItem, TabsListProps, TabsPanelProps, TabsRootProps } from './Tabs';

// CopyButton + CopyField
export { CopyButton, CopyField } from './CopyButton';
export type { CopyButtonProps, CopyFieldProps } from './CopyButton';

export { NavRow } from './NavRow';
export type { NavRowProps } from './NavRow';

// InlineEditText (styled preset) + useInlineEdit (the rename behaviour it presets)
export { InlineEditText } from './InlineEditText';
export type { InlineEditTextProps } from './InlineEditText';
export { useInlineEdit } from './InlineEditText/useInlineEdit';

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

export { ToastContainer } from './Toast';
export type { ToastContainerProps, ToastData, ToastType } from './Toast';

// Icons
export {
  // Base icon component
  Icon,
  // Individual icons
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
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
  ChevronDoubleLeftIconProps,
  ChevronDoubleRightIconProps,
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
