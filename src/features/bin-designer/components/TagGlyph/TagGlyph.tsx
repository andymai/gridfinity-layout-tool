import { ColorSwatch } from '@/design-system';
import type { TagAppearance } from '../../store/tagAppearance';

interface TagGlyphProps {
  appearance: TagAppearance | undefined;
}

/**
 * Leading visual for a tag chip: the tag's icon when set, else a color dot
 * when only a color is set, else nothing. Decorative — the tag text next to
 * it carries the accessible name.
 */
export function TagGlyph({ appearance }: TagGlyphProps) {
  if (appearance?.icon !== undefined) {
    return (
      <span aria-hidden="true" className="leading-none">
        {appearance.icon}
      </span>
    );
  }
  if (appearance?.color !== undefined) {
    return <ColorSwatch color={appearance.color} size="sm" />;
  }
  return null;
}
