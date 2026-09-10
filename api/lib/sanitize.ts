export function sanitizeString(str: string, maxLength: number): string {
  // Remove null bytes and control characters, trim, truncate
  return (
    str
      // eslint-disable-next-line no-control-regex -- stripping control bytes is the point
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim()
      .slice(0, maxLength)
  );
}
