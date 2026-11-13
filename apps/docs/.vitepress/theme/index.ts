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
// search box 404s. One reload picks up the new ones. The stored time stops a
// broken deploy from reloading in a loop, so with no storage there is no reload.
function reloadOnStaleChunk(): void {
  const key = 'gridfinity-docs:stale-chunk-reload';
  window.addEventListener('vite:preloadError', (event) => {
    try {
      if (Date.now() - Number(sessionStorage.getItem(key) ?? 0) < 10_000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      return;
    }
    event.preventDefault();
    window.location.reload();
  });
}

// Vercel's edge serves the analytics script; on any other host it 404s on every
// page load. The literal comparison lets a self-hosted build drop the chunk.
function countPageViews(): void {
  if (!import.meta.env.PROD) return;
  if ((import.meta.env.VITE_SELF_HOSTED as string | undefined) === '1') return;
  void import('@vercel/analytics').then(({ inject }) => {
    inject({ mode: 'production' });
  });
}

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Screenshot', Screenshot);
    app.component('Ui', UnrenderedUi);
    if (typeof window !== 'undefined') {
      reloadOnStaleChunk();
      countPageViews();
    }
  },
};

export default theme;
