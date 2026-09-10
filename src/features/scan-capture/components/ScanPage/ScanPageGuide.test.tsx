import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useTranslation } from '@/i18n';
import { CaptureGuide, CardStatusIcon, ProgressSteps } from './ScanPageGuide';

function GuideHarness() {
  const t = useTranslation();
  return <CaptureGuide t={t} />;
}

describe('ScanPageGuide', () => {
  it('lists the three steps in order', () => {
    render(<ProgressSteps current="review" labels={['Capture', 'Review', 'Done']} />);
    const text = screen.getByText('Capture').closest('ol, ul, div')?.textContent ?? '';
    expect(text.indexOf('Capture')).toBeLessThan(text.indexOf('Review'));
    expect(text.indexOf('Review')).toBeLessThan(text.indexOf('Done'));
  });

  it('draws a status glyph for both outcomes', () => {
    const { container: okRoot } = render(<CardStatusIcon ok />);
    const { container: badRoot } = render(<CardStatusIcon ok={false} />);
    expect(okRoot.querySelector('svg')).not.toBeNull();
    expect(badRoot.querySelector('svg')).not.toBeNull();
    expect(okRoot.innerHTML).not.toBe(badRoot.innerHTML);
  });

  it('shows the example photo inside the capture guide', () => {
    const { container } = render(<GuideHarness />);
    expect(container.querySelector('img[src="/images/scan/scan-example.webp"]')).not.toBeNull();
  });
});
