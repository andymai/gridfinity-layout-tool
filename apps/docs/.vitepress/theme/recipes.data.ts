import { createContentLoader } from 'vitepress';
import { sidebar } from '../navigation.ts';

export interface Recipe {
  readonly link: string;
  readonly title: string;
  readonly description: string;
  readonly heroId: string;
  /** Zooms the card picture toward a point, for a hero that shows the whole window. */
  readonly card?: { readonly zoom: number; readonly focus: string };
}

function cardCrop(value: unknown): Recipe['card'] {
  if (typeof value !== 'object' || value === null) return undefined;
  const { zoom, focus } = value as { zoom?: unknown; focus?: unknown };
  return typeof zoom === 'number' && typeof focus === 'string' ? { zoom, focus } : undefined;
}

declare const data: Recipe[];
export { data };

// In sidebar order, so the cards read in the same order as the menu.
const order = (sidebar.find((group) => group.text === 'Recipes')?.items ?? []).map(
  (item) => item.link
);

export default createContentLoader('recipes/*.md', {
  transform(pages): Recipe[] {
    const recipes = pages.map((page) => {
      const slug = page.url.replace(/^\/recipes\//, '').replace(/\.html$/, '');
      const front = page.frontmatter as { title?: unknown; description?: unknown; card?: unknown };
      if (typeof front.title !== 'string' || typeof front.description !== 'string')
        throw new Error(`recipes/${slug}.md needs a title and a description`);
      return {
        link: `/recipes/${slug}`,
        title: front.title,
        description: front.description,
        heroId: `recipes-${slug}-hero`,
        card: cardCrop(front.card),
      };
    });
    const rank = (r: Recipe): number => {
      const i = order.indexOf(r.link);
      return i === -1 ? order.length : i;
    };
    return recipes.sort((a, b) => rank(a) - rank(b));
  },
});
