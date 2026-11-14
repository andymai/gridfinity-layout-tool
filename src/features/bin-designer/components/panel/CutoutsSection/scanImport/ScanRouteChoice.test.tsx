import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScanRouteChoice } from './ScanRouteChoice';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('ScanRouteChoice', () => {
  it('offers the phone and this computer as two buttons', () => {
    const onPhone = vi.fn();
    const onComputer = vi.fn();
    render(<ScanRouteChoice onPhone={onPhone} onComputer={onComputer} />);

    fireEvent.click(screen.getByRole('button', { name: /scanImport\.routePhone/ }));
    expect(onPhone).toHaveBeenCalledOnce();
    expect(onComputer).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /traceView\.open/ }));
    expect(onComputer).toHaveBeenCalledOnce();
  });

  it('says where each photo stays', () => {
    render(<ScanRouteChoice onPhone={vi.fn()} onComputer={vi.fn()} />);
    expect(screen.getByText('binDesigner.cutouts.scanImport.routePhoneHelp')).toBeInTheDocument();
    expect(screen.getByText('binDesigner.cutouts.traceView.openHelp')).toBeInTheDocument();
  });
});
