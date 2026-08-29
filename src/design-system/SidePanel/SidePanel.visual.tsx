import { test, expect } from '@playwright/experimental-ct-react';
import { SidePanel } from './SidePanel';

const labels = { collapse: 'Collapse', expand: 'Expand', resize: 'Resize' };

test.describe('SidePanel visual', () => {
  test('expanded frame', async ({ mount }) => {
    const component = await mount(
      <div style={{ display: 'flex', height: 320 }}>
        <div style={{ flex: 1 }} />
        <SidePanel.Root labels={labels} railTitle="Inspector" defaultWidth={260}>
          <SidePanel.Header>
            <span className="text-xs font-semibold uppercase tracking-wider text-content-secondary">
              Inspector
            </span>
          </SidePanel.Header>
          <SidePanel.Body className="px-4 py-3">
            <p className="text-body">Panel content</p>
          </SidePanel.Body>
        </SidePanel.Root>
      </div>
    );
    await expect(component).toHaveScreenshot('sidepanel-expanded.png');
  });

  test('collapsed rail', async ({ mount }) => {
    const component = await mount(
      <div style={{ display: 'flex', height: 320 }}>
        <div style={{ flex: 1 }} />
        <SidePanel.Root labels={labels} railTitle="Inspector" defaultCollapsed>
          <SidePanel.Body>
            <p>hidden</p>
          </SidePanel.Body>
        </SidePanel.Root>
      </div>
    );
    await expect(component).toHaveScreenshot('sidepanel-collapsed.png');
  });
});
