// No imports: config.ts reads these in Node to write the head script.

/** False hides Ask AI unless the URL carries ?ask=1, for testing a change before readers see it. */
export const ASK_AI_PUBLIC = true;
export const PREVIEW_KEY = 'gridfinity-docs:ask-ai-preview';
export const DOCK_QUERY = '(min-width: 80rem)';
export const DOCKED_CLASS = 'ask-ai-docked';
/** Set while the endpoint is off, so the head script docks no panel that the check would remove. */
export const OFF_KEY = 'gridfinity-docs:ask-ai-off';

/**
 * Sets the dock class before first paint. The theme mounts the panel only
 * after hydration, and without this the page would paint full width and then
 * reflow, on every load from search.
 */
export const DOCK_SCRIPT = `try{if(matchMedia(${JSON.stringify(DOCK_QUERY)}).matches&&(${String(ASK_AI_PUBLIC)}||/[?&]ask=1(&|$)/.test(location.search)||sessionStorage.getItem(${JSON.stringify(PREVIEW_KEY)})==='1')&&localStorage.getItem(${JSON.stringify(OFF_KEY)})!=='1')document.documentElement.classList.add(${JSON.stringify(DOCKED_CLASS)})}catch(e){}`;
