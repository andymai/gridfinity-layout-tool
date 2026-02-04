# Gridfinity Design System

A comprehensive, type-safe component library for the Gridfinity Layout Tool.

## Quick Reference

### Import

```typescript
import { Button, Dialog, Stepper, cn } from '@/design-system';
```

### Component Categories

| Category       | Components                                    | Purpose                          |
| -------------- | --------------------------------------------- | -------------------------------- |
| **Primitives** | Button, Checkbox, Input, Select, Spinner      | Basic building blocks            |
| **Composite**  | Stepper, Collapsible, Dialog, Menu, Toast     | Complex UI patterns              |
| **Icons**      | Icon, ChevronDownIcon, CheckIcon, XIcon, etc. | SVG icons with consistent sizing |

### Size Scale

All components support `size: 'sm' | 'md' | 'lg'`:

| Size | Height | Text | Use Case                  |
| ---- | ------ | ---- | ------------------------- |
| `sm` | 32px   | 12px | Compact UI, dense layouts |
| `md` | 40px   | 14px | Default, most contexts    |
| `lg` | 48px   | 16px | Touch-friendly, prominent |

### Variant Scale

Interactive components support `variant`:

| Variant     | Appearance     | Use Case                     |
| ----------- | -------------- | ---------------------------- |
| `primary`   | Amber gradient | Main actions (Save, Submit)  |
| `secondary` | Gray gradient  | Default actions              |
| `ghost`     | Transparent    | Subtle actions, icon buttons |
| `danger`    | Red gradient   | Destructive actions (Delete) |

## Architecture

### File Structure

```
src/design-system/
├── index.ts              # Public exports
├── cn.ts                 # Class merge utility
├── variants.ts           # Shared CVA configurations
├── {Component}/
│   ├── {Component}.tsx   # Component implementation
│   ├── {Component}.test.tsx
│   └── index.ts          # Named exports
├── Icon/
│   ├── Icon.tsx          # Base icon component
│   ├── icons/            # Individual icon components
│   └── index.ts
└── docs/                 # This documentation
```

### Design Principles

1. **Type Safety**: Full TypeScript with generics, discriminated unions
2. **Accessibility**: WCAG 2.1 AA, keyboard navigation, ARIA attributes
3. **Simplicity**: Minimal API surface, sensible defaults
4. **Consistency**: Shared variants, predictable prop patterns

### Styling with CVA

Components use `class-variance-authority` for type-safe variants:

```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva('base-classes', {
  variants: {
    size: { sm: '...', md: '...', lg: '...' },
    variant: { primary: '...', secondary: '...' },
  },
  defaultVariants: { size: 'md', variant: 'secondary' },
});

type ButtonProps = VariantProps<typeof buttonVariants>;
```

### Class Merging

Use `cn()` to merge Tailwind classes safely:

```typescript
import { cn } from '@/design-system';

cn('px-4 py-2', isActive && 'bg-accent', className);
// Handles conflicts, conditionals, and overrides
```

## Component Patterns

### Compound Components

Complex components use the compound pattern:

```tsx
// Dialog
<Dialog.Root open={isOpen} onClose={close}>
  <Dialog.Header title="Confirm" />
  <Dialog.Body>Content here</Dialog.Body>
  <Dialog.Footer>
    <Button onClick={close}>Cancel</Button>
    <Button variant="primary" onClick={confirm}>Confirm</Button>
  </Dialog.Footer>
</Dialog.Root>

// Menu
<Menu.Root open={open} onClose={close} position={pos}>
  <Menu.Item icon={<EditIcon />} onClick={edit}>Edit</Menu.Item>
  <Menu.Divider />
  <Menu.Item variant="danger" onClick={del}>Delete</Menu.Item>
</Menu.Root>
```

### Controlled vs Uncontrolled

Components support both patterns where applicable:

```tsx
// Controlled
<Checkbox checked={value} onChange={setValue} />

// Uncontrolled
<Checkbox defaultChecked name="agree" />
```

## Usage Guidelines

### When to Use Each Component

| Need                       | Component        |
| -------------------------- | ---------------- |
| Trigger an action          | `Button`         |
| Toggle a boolean           | `Checkbox`       |
| Enter text                 | `Input`          |
| Choose from options        | `Select`         |
| Increment/decrement number | `Stepper`        |
| Show/hide content          | `Collapsible`    |
| Modal confirmation         | `Dialog`         |
| Context actions            | `Menu`           |
| Notify user                | `ToastContainer` |

### Accessibility Checklist

- [ ] Interactive elements have `aria-label` or visible labels
- [ ] Buttons describe their action (not just "Click here")
- [ ] Form inputs have associated labels
- [ ] Dialogs trap focus and restore on close
- [ ] Menus support keyboard navigation

## See Also

- [COMPONENTS.md](./COMPONENTS.md) - Detailed component API reference
- [TOKENS.md](./TOKENS.md) - Design tokens and CSS variables
- [components.json](./components.json) - Machine-readable component schema
