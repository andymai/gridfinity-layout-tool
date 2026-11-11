import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import Screenshot from './components/Screenshot.vue';
import './custom.css';

// The markdown rule replaces every <Ui> tag before Vue sees a page. A tag that
// slips past it would render as an empty node, so the build fails instead.
const UnrenderedUi = {
  props: { k: { type: String, default: '' } },
  setup(props: { k: string }): never {
    throw new Error(`<Ui k="${props.k}" /> reached Vue without its label`);
  },
};

// After a deploy, an open tab still asks for the old chunk hashes, and the lazy
// search box 404s. One reload picks up the new ones. The guard stops a broken
// deploy from reloading in a loop.
function reloadOnStaleChunk(): void {
  const key = 'gridfinity-docs:stale-chunk-reload';
  window.addEventListener('vite:preloadError', (event) => {
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(key) ?? 0);
    } catch {
      // Without sessionStorage the guard cannot hold, so allow the reload.
    }
    if (Date.now() - last < 10_000) return;
    try {
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // A missing guard costs at most one extra reload.
    }
    event.preventDefault();
    window.location.reload();
  });
}

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Screenshot', Screenshot);
    app.component('Ui', UnrenderedUi);
    if (typeof window !== 'undefined') reloadOnStaleChunk();
  },
};

export default theme;
