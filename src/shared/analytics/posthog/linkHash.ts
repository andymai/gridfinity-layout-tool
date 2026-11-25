/**
 * A `#share=` or `#plan=` link carries a whole layout or plan, labels and
 * items included, in its hash. PostHog puts the address on every event, and
 * session replay records it, so neither may see that hash. This module
 * imports nothing: init.ts is on the path from the stores to trackEvent, and
 * the storage modules that read links would close an import cycle there.
 */
const isLinkContent = (hash: string): boolean =>
  hash.includes('share=') || hash.startsWith('#plan=');

export function linkContentInAddressBar(): boolean {
  return typeof window !== 'undefined' && isLinkContent(window.location.hash);
}

/**
 * Resolves once the address bar no longer holds link content. The importer
 * clears it after it decodes the link; other code can clear it too, so this
 * reads the address instead of waiting for one caller.
 */
export function whenLinkContentCleared(intervalMs = 250): Promise<void> {
  if (!linkContentInAddressBar()) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = window.setInterval(() => {
      if (linkContentInAddressBar()) return;
      window.clearInterval(timer);
      resolve();
    }, intervalMs);
  });
}

type Properties = Record<string, unknown>;

function withoutFragments(properties: Properties | undefined): Properties | undefined {
  if (properties === undefined) return undefined;
  const out: Properties = {};
  for (const [key, value] of Object.entries(properties)) {
    if ((key === '$set' || key === '$set_once') && typeof value === 'object' && value !== null) {
      // Person updates can ride inside the event properties too.
      out[key] = withoutFragments(value as Properties);
      continue;
    }
    out[key] =
      typeof value === 'string' && /url/i.test(key) && value.includes('#')
        ? value.slice(0, value.indexOf('#'))
        : value;
  }
  return out;
}

/** Drops the hash from every URL property of an event, the person properties it sets included. */
export function stripUrlFragments<
  T extends { properties?: Properties; $set?: Properties; $set_once?: Properties },
>(event: T): T {
  return {
    ...event,
    ...(event.properties ? { properties: withoutFragments(event.properties) } : {}),
    ...(event.$set ? { $set: withoutFragments(event.$set) } : {}),
    ...(event.$set_once ? { $set_once: withoutFragments(event.$set_once) } : {}),
  };
}
