# Categories

Bin color-coding system for visual organization.

## Key Files

| File                             | Purpose                               |
| -------------------------------- | ------------------------------------- |
| `components/CategoriesPanel.tsx` | Category list with CRUD, color picker |

## Core Concepts

- Each bin has a `category` field (category ID)
- Categories have `id`, `name`, and `color` (hex)
- Default category created on layout init
- Colors rendered on bins and in print list

## Data Flow

```
addCategory({ name, color }) → new category with generated ID
updateCategory(id, { color }) → all bins with that category update visually
deleteCategory(id) → bins reassigned to first remaining category
```

## Constraints

- **Min 1 category** - can't delete the last one
- **Max 20 categories** - CONSTRAINTS.MAX_CATEGORIES
- **Color format** - hex string (e.g., `#3B82F6`)

## Gotchas

1. **Deleting category reassigns bins** - not orphaned
2. **Category ID used in bin.category** - not name
3. **Print list groups by category** - affects export organization

## Integration

- **grid-editor**: Bin colors derived from category
- **print-export**: Groups bins by category in print list
- **layout store**: Category CRUD with Result types
