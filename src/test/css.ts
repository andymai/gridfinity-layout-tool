/**
 * A CSS value as the test DOM stores it. jsdom rewrites inline styles (colours
 * to `rgb()`, `0` to `0px` in transforms, numbers to six significant digits),
 * and the rules change between versions, so compare against this, not a literal.
 */
export function cssValue(property: string, value: string): string {
  const probe = document.createElement('div');
  probe.style.setProperty(property, value);
  return probe.style.getPropertyValue(property);
}
