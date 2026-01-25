# Inspiration Gallery

Curated example layouts organized by theme for user onboarding.

## Key Files

| File                                | Purpose                                 |
| ----------------------------------- | --------------------------------------- |
| `components/InspirationGallery.tsx` | Modal with theme filtering              |
| `components/LayoutCard.tsx`         | Individual layout preview card          |
| `components/ThemeFilterPills.tsx`   | Theme category filter buttons           |
| `data/themes/*.ts`                  | Layout definitions by theme             |
| `utils/layoutBuilder.ts`            | Converts InspirationLayout → Layout     |
| `types.ts`                          | InspirationLayout, InspirationBin types |

## Themes

| Theme    | Examples                        |
| -------- | ------------------------------- |
| Workshop | Tool drawer, hardware organizer |
| Office   | Desk drawer, supplies           |
| Kitchen  | Utensil drawer, spice rack      |
| Hobby    | Craft supplies, sewing          |
| Personal | Bathroom drawer, jewelry        |

## Data Structure

```typescript
interface InspirationLayout {
  id: string;
  name: string;
  description: string;
  theme: Theme;
  drawer: { width; depth; height };
  bins: InspirationBin[]; // Simplified bin format
  tags: string[];
}
```

## Data Flow

```
User selects layout → buildLayoutFromInspiration(inspiration)
  → generates full Layout with IDs, layers, categories
  → importLayout() loads into editor
```

## Gotchas

1. **Layouts are templates** - importing creates copy, not reference
2. **Simplified bin format** - no layerId (defaults to first layer)
3. **Categories auto-generated** - from bin category names in template
4. **Lazy-loaded modal** - chunk split for bundle size

## Integration

- **layout store**: `importLayout()` loads generated layout
- **layout-library**: Creates new entry on import
- **MobileLayoutsPanel**: Links to gallery for mobile users
