# Component API Reference

Complete API documentation for all design system components.

---

## Button

Interactive element for triggering actions.

### Props

| Prop        | Type                                              | Default       | Description                         |
| ----------- | ------------------------------------------------- | ------------- | ----------------------------------- |
| `variant`   | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'secondary'` | Visual style                        |
| `size`      | `'sm' \| 'md' \| 'lg'`                            | `'md'`        | Size variant                        |
| `loading`   | `boolean`                                         | `false`       | Shows spinner, disables interaction |
| `leftIcon`  | `ReactNode`                                       | -             | Icon before children                |
| `rightIcon` | `ReactNode`                                       | -             | Icon after children                 |
| `iconOnly`  | `boolean`                                         | `false`       | Square button for icon-only use     |
| `fullWidth` | `boolean`                                         | `false`       | Expand to full container width      |
| `disabled`  | `boolean`                                         | `false`       | Disable interaction                 |

### Examples

```tsx
// Primary action
<Button variant="primary">Save Changes</Button>

// With icon
<Button leftIcon={<PlusIcon />}>Add Item</Button>

// Icon-only (requires aria-label)
<Button iconOnly variant="ghost" aria-label="Close">
  <XIcon />
</Button>

// Loading state
<Button loading variant="primary">Saving...</Button>

// Destructive
<Button variant="danger" leftIcon={<TrashIcon />}>Delete</Button>
```

---

## Checkbox

Toggle control for boolean values.

### Props

| Prop             | Type                         | Default | Description                |
| ---------------- | ---------------------------- | ------- | -------------------------- |
| `checked`        | `boolean`                    | -       | Controlled checked state   |
| `defaultChecked` | `boolean`                    | -       | Uncontrolled initial state |
| `onChange`       | `(checked: boolean) => void` | -       | Change handler             |
| `indeterminate`  | `boolean`                    | `false` | Show indeterminate state   |
| `label`          | `string`                     | -       | Visible label text         |
| `size`           | `'sm' \| 'md' \| 'lg'`       | `'md'`  | Size variant               |
| `disabled`       | `boolean`                    | `false` | Disable interaction        |

### Examples

```tsx
// Controlled
<Checkbox checked={agreed} onChange={setAgreed} label="I agree" />

// Uncontrolled in form
<Checkbox defaultChecked name="newsletter" label="Subscribe" />

// Indeterminate (select all)
<Checkbox
  indeterminate={someSelected && !allSelected}
  checked={allSelected}
  onChange={toggleAll}
  label="Select all"
/>

// Display-only (inside clickable row)
<Checkbox checked={isSelected} />
```

---

## Input

Text input with optional icons.

### Props

| Prop               | Type                   | Default | Description                 |
| ------------------ | ---------------------- | ------- | --------------------------- |
| `size`             | `'sm' \| 'md' \| 'lg'` | `'md'`  | Size variant                |
| `leftIcon`         | `ReactNode`            | -       | Icon at input start         |
| `rightIcon`        | `ReactNode`            | -       | Icon/button at input end    |
| `error`            | `boolean`              | `false` | Error state styling         |
| `wrapperClassName` | `string`               | -       | Classes for wrapper element |

### Examples

```tsx
// Basic
<Input placeholder="Enter name" aria-label="Name" />

// With search icon
<Input leftIcon={<SearchIcon />} placeholder="Search..." />

// With clear button
<Input
  value={query}
  onChange={e => setQuery(e.target.value)}
  rightIcon={
    query && (
      <button onClick={() => setQuery('')} aria-label="Clear">
        <XIcon />
      </button>
    )
  }
/>

// Error state
<Input error aria-describedby="email-error" />
<span id="email-error">Invalid email</span>

// Number input
<Input type="number" min={0} max={100} step={0.5} />
```

---

## Select

Native dropdown with consistent styling.

### Props

| Prop          | Type                   | Default      | Description                    |
| ------------- | ---------------------- | ------------ | ------------------------------ |
| `options`     | `SelectOption[]`       | **required** | List of options                |
| `placeholder` | `string`               | -            | Placeholder text               |
| `colorSwatch` | `string \| null`       | -            | Color indicator (null = mixed) |
| `size`        | `'sm' \| 'md' \| 'lg'` | `'md'`       | Size variant                   |
| `fullWidth`   | `boolean`              | `false`      | Expand to full width           |
| `error`       | `boolean`              | `false`      | Error state styling            |

### SelectOption

```typescript
interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
```

### Examples

```tsx
// Basic
<Select
  value={sort}
  onChange={e => setSort(e.target.value)}
  options={[
    { value: 'name', label: 'Name' },
    { value: 'date', label: 'Date' },
  ]}
  aria-label="Sort by"
/>

// With placeholder
<Select
  value={category}
  onChange={handleChange}
  options={categories}
  placeholder="Select category"
/>

// With color swatch
<Select
  value={selectedId}
  onChange={handleChange}
  options={categories}
  colorSwatch={getCategoryColor(selectedId)}
/>
```

---

## Stepper

Numeric input with increment/decrement buttons.

### Props

| Prop           | Type                      | Default      | Description                     |
| -------------- | ------------------------- | ------------ | ------------------------------- |
| `value`        | `number`                  | **required** | Current value                   |
| `onChange`     | `(value: number) => void` | -            | Input change handler            |
| `onStep`       | `(delta: number) => void` | **required** | Button click handler (+1/-1)    |
| `min`          | `number`                  | **required** | Minimum value                   |
| `max`          | `number`                  | **required** | Maximum value                   |
| `step`         | `number`                  | `1`          | Input step increment            |
| `displayValue` | `ReactNode`               | -            | Static display (disables input) |
| `size`         | `'sm' \| 'md' \| 'lg'`    | `'md'`       | Size variant                    |
| `aria-label`   | `string`                  | **required** | Accessibility label             |

### Examples

```tsx
// Editable input
<Stepper
  value={width}
  onChange={setWidth}
  onStep={delta => setWidth(w => w + delta * 0.5)}
  min={0.5}
  max={50}
  step={0.5}
  aria-label="Width"
/>

// Display mode (buttons only)
<Stepper
  value={height}
  onStep={delta => setHeight(h => h + delta)}
  min={1}
  max={10}
  displayValue={`${height}u`}
  aria-label="Height units"
/>

// Large touch-friendly
<Stepper
  size="lg"
  value={qty}
  onStep={delta => setQty(q => q + delta)}
  min={1}
  max={99}
  displayValue={qty}
  aria-label="Quantity"
/>
```

---

## Collapsible

Expandable section with animated transition.

### Props

| Prop               | Type                          | Default      | Description                    |
| ------------------ | ----------------------------- | ------------ | ------------------------------ |
| `title`            | `string`                      | **required** | Section title                  |
| `children`         | `ReactNode`                   | **required** | Section content                |
| `defaultExpanded`  | `boolean`                     | `true`       | Initial state (uncontrolled)   |
| `expanded`         | `boolean`                     | -            | Controlled expanded state      |
| `onExpandedChange` | `(expanded: boolean) => void` | -            | Controlled change handler      |
| `badge`            | `ReactNode`                   | -            | Badge next to title            |
| `actions`          | `ReactNode`                   | -            | Actions in header (right side) |
| `icon`             | `ReactNode`                   | -            | Icon before title              |
| `summary`          | `ReactNode`                   | -            | Shown when collapsed           |
| `size`             | `'sm' \| 'md'`                | `'md'`       | Header text size               |

### Examples

```tsx
// Basic
<Collapsible title="Settings">
  <SettingsContent />
</Collapsible>

// With badge and actions
<Collapsible
  title="Categories"
  badge={<span className="badge">5</span>}
  actions={<Button size="sm" iconOnly><PlusIcon /></Button>}
>
  <CategoryList />
</Collapsible>

// With summary preview
<Collapsible
  title="Dimensions"
  icon={<CubeIcon />}
  summary="2×2×3u"
>
  <DimensionControls />
</Collapsible>

// Controlled
<Collapsible
  title="Advanced"
  expanded={showAdvanced}
  onExpandedChange={setShowAdvanced}
>
  <AdvancedOptions />
</Collapsible>
```

---

## Dialog

Modal dialog with focus management.

### Compound Components

- `Dialog.Root` - Container with open/close logic
- `Dialog.Header` - Title and close button
- `Dialog.Body` - Main content (scrollable)
- `Dialog.Footer` - Action buttons

### Dialog.Root Props

| Prop                  | Type                                     | Default      | Description             |
| --------------------- | ---------------------------------------- | ------------ | ----------------------- |
| `open`                | `boolean`                                | **required** | Open state              |
| `onClose`             | `() => void`                             | **required** | Close handler           |
| `size`                | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'` | `'md'`       | Width variant           |
| `position`            | `'center' \| 'top'`                      | `'center'`   | Vertical position       |
| `closeOnOverlayClick` | `boolean`                                | `true`       | Close on backdrop click |
| `closeOnEscape`       | `boolean`                                | `true`       | Close on Escape key     |

### Examples

```tsx
// Confirmation dialog
<Dialog.Root open={isOpen} onClose={close}>
  <Dialog.Header title="Confirm Delete" />
  <Dialog.Body>
    Are you sure? This cannot be undone.
  </Dialog.Body>
  <Dialog.Footer>
    <Button variant="ghost" onClick={close}>Cancel</Button>
    <Button variant="danger" onClick={handleDelete}>Delete</Button>
  </Dialog.Footer>
</Dialog.Root>

// Form dialog
<Dialog.Root open={open} onClose={close} size="lg">
  <Dialog.Header title="Edit Item" />
  <Dialog.Body>
    <form>
      <Input label="Name" />
      <Select options={options} />
    </form>
  </Dialog.Body>
  <Dialog.Footer>
    <Button variant="ghost" onClick={close}>Cancel</Button>
    <Button variant="primary" onClick={save}>Save</Button>
  </Dialog.Footer>
</Dialog.Root>
```

---

## Menu

Context menu with keyboard navigation.

### Compound Components

- `Menu.Root` - Container with positioning
- `Menu.Item` - Individual menu items
- `Menu.Divider` - Visual separator

### Menu.Root Props

| Prop       | Type                       | Default      | Description     |
| ---------- | -------------------------- | ------------ | --------------- |
| `open`     | `boolean`                  | **required** | Open state      |
| `onClose`  | `() => void`               | **required** | Close handler   |
| `position` | `{ x: number; y: number }` | **required** | Screen position |

### Menu.Item Props

| Prop       | Type                    | Default     | Description            |
| ---------- | ----------------------- | ----------- | ---------------------- |
| `onClick`  | `() => void`            | -           | Click handler          |
| `icon`     | `ReactNode`             | -           | Icon before label      |
| `variant`  | `'default' \| 'danger'` | `'default'` | Visual style           |
| `disabled` | `boolean`               | `false`     | Disable interaction    |
| `shortcut` | `string`                | -           | Keyboard shortcut hint |

### Examples

```tsx
// Basic context menu
const [menu, setMenu] = useState({ open: false, x: 0, y: 0 });

<div onContextMenu={e => {
  e.preventDefault();
  setMenu({ open: true, x: e.clientX, y: e.clientY });
}}>
  Right-click me
</div>

<Menu.Root
  open={menu.open}
  onClose={() => setMenu(m => ({ ...m, open: false }))}
  position={{ x: menu.x, y: menu.y }}
>
  <Menu.Item icon={<EditIcon />} onClick={edit}>
    Edit
  </Menu.Item>
  <Menu.Item icon={<CopyIcon />} onClick={duplicate} shortcut="⌘D">
    Duplicate
  </Menu.Item>
  <Menu.Divider />
  <Menu.Item icon={<TrashIcon />} variant="danger" onClick={del}>
    Delete
  </Menu.Item>
</Menu.Root>
```

---

## ToastContainer

Container for toast notifications.

### Props

| Prop        | Type                                                | Default          | Description       |
| ----------- | --------------------------------------------------- | ---------------- | ----------------- |
| `toasts`    | `ToastData[]`                                       | **required**     | Toasts to display |
| `onDismiss` | `(id: string) => void`                              | **required**     | Dismiss handler   |
| `position`  | `'top-center' \| 'bottom-right' \| 'bottom-center'` | `'bottom-right'` | Screen position   |

### ToastData

```typescript
interface ToastData {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number; // ms, 0 = no auto-dismiss
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

### Examples

```tsx
// Setup
const [toasts, setToasts] = useState<ToastData[]>([]);

const addToast = (toast: Omit<ToastData, 'id'>) => {
  setToasts((t) => [...t, { ...toast, id: crypto.randomUUID() }]);
};

const removeToast = (id: string) => {
  setToasts((t) => t.filter((toast) => toast.id !== id));
};

// Render
<ToastContainer toasts={toasts} onDismiss={removeToast} />;

// Usage
addToast({ type: 'success', message: 'Saved!' });

addToast({
  type: 'info',
  message: 'Item deleted',
  action: { label: 'Undo', onClick: undoDelete },
});

addToast({
  type: 'error',
  message: 'Failed to save',
  duration: 0, // No auto-dismiss
});
```

---

## Spinner

Loading indicator.

### Props

| Prop    | Type                   | Default     | Description         |
| ------- | ---------------------- | ----------- | ------------------- |
| `size`  | `'sm' \| 'md' \| 'lg'` | `'md'`      | Size variant        |
| `label` | `string`               | `'Loading'` | Screen reader label |

### Examples

```tsx
<Spinner />
<Spinner size="lg" label="Saving changes" />
<Button disabled><Spinner size="sm" /> Loading...</Button>
```

---

## Icon

Base SVG icon component.

### Props

| Prop       | Type                                   | Default      | Description                      |
| ---------- | -------------------------------------- | ------------ | -------------------------------- |
| `size`     | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'`       | Size variant                     |
| `label`    | `string`                               | -            | Accessible label (if meaningful) |
| `children` | `ReactNode`                            | **required** | SVG paths                        |

### Available Icons

- `ChevronDownIcon` - Dropdown, collapsible
- `CheckIcon` - Success, checkbox
- `XIcon` - Close, cancel
- `PlusIcon` - Add, increment
- `MinusIcon` - Remove, decrement
- `SearchIcon` - Search input
- `TrashIcon` - Delete
- `AlertTriangleIcon` - Warning, error
- `InfoIcon` - Information

### Examples

```tsx
// Decorative (next to text)
<Button leftIcon={<PlusIcon size="sm" />}>Add</Button>

// Meaningful (standalone)
<CheckIcon label="Success" className="text-success" />

// Custom icon
<Icon size="md">
  <path d="M12 2L2 7l10 5 10-5-10-5z" />
</Icon>
```
