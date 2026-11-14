/**
 * Prints the controls on an app route and saves a screenshot, for writing a
 * shot: `pnpm exec tsx scripts/docs-capture/probe.ts <route> [out.png] [click text...]`.
 */

import { WORKBENCH, layoutFile } from './fixtures';
import { openDocsSession } from './session';

async function main(): Promise<void> {
  const [route = '/', out = 'node_modules/.cache/docs-capture/probe.png', ...clicks] =
    process.argv.slice(2);
  const s = await openDocsSession(process.env.BASE_URL ?? 'http://localhost:5173', 'dark', {
    id: 'probe',
    kind: 'still',
    take: async () => {},
  });
  try {
    const ready = (p: typeof s.page) => p.locator('header').first();
    await s.open(route, ready);
    if (route === '/' || route === '/baseplate')
      await s.importLayouts([layoutFile(WORKBENCH)], ready);
    for (const text of clicks) {
      await s.page.getByText(text, { exact: true }).first().click({ force: true });
      await s.ui.warm(20);
      await s.page.waitForTimeout(800);
    }
    const controls = await s.page
      .locator(
        'button, input, select, [role="switch"], [role="tab"], [role="radio"], [role="slider"], h2, h3'
      )
      .evaluateAll((els) =>
        els
          .filter((e) => (e as HTMLElement).offsetParent !== null)
          .map((e) => {
            const r = e.getBoundingClientRect();
            const name = e.getAttribute('aria-label') ?? (e.textContent ?? '').trim().slice(0, 50);
            return `${e.tagName.toLowerCase()}${e.getAttribute('role') ? `[${e.getAttribute('role')}]` : ''} "${name}" @${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
          })
      );
    process.stdout.write(`${controls.join('\n')}\n`);
    await s.page.screenshot({ path: out });
  } finally {
    await s.close();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
