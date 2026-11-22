// The theme's .ts files import components; vue-tsc, not this check, reads the .vue files.
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent;
  export default component;
}
