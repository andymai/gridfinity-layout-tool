/**
 * Build-time gate for the multi-device sync UI.
 *
 * The sync stack ships in 6 PRs; only PR 6 wires up a complete
 * user-visible flow. Until then, the auth surface (SignInButton,
 * useSessionLifecycle) is built and tested but **not mounted** in
 * production, so users don't see a sign-in affordance that does
 * nothing yet.
 *
 * The gate reads `VITE_ENABLE_SYNC_UI`. Vite inlines `import.meta.env.*`
 * at build time, so when the var is unset the comparison folds to
 * `false` and dead-code-elimination drops the SignInButton chunk
 * from the production bundle entirely.
 *
 * Local development:
 *   echo 'VITE_ENABLE_SYNC_UI=1' >> .env.local
 *
 * PR 6 will replace this with a graduated default of `true` (or
 * remove the gate entirely once the feature is stable).
 */
export const SYNC_UI_ENABLED = import.meta.env.VITE_ENABLE_SYNC_UI === '1';
