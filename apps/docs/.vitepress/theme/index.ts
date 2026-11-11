import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import Screenshot from './components/Screenshot.vue';
import './custom.css';

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Screenshot', Screenshot);
  },
};

export default theme;
