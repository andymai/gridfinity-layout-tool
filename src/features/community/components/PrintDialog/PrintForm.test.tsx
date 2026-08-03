// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { COMMUNITY_PRINTERS } from '@/shared/types/communityPrinters';
import { DEFAULT_PRINT_DRAFT } from '../../store/printDialogStore';
import { PrintForm } from './PrintForm';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));
vi.mock('../../utils/printPhoto', () => ({ preparePrintPhoto: vi.fn() }));

function setup(overrides: Partial<React.ComponentProps<typeof PrintForm>> = {}) {
  const props = {
    draft: DEFAULT_PRINT_DRAFT,
    displayName: 'Casey',
    photos: [],
    photoError: null,
    issues: {},
    disabled: false,
    onDraftChange: vi.fn(),
    onDisplayNameChange: vi.fn(),
    onAddPhoto: vi.fn(),
    onRemovePhoto: vi.fn(),
    onPhotoError: vi.fn(),
    ...overrides,
  };
  render(<PrintForm {...props} />);
  return props;
}

describe('PrintForm', () => {
  it('offers every curated printer plus a placeholder', () => {
    setup();
    const select = screen.getByLabelText('community.print.printerLabel');
    expect(select.querySelectorAll('option')).toHaveLength(COMMUNITY_PRINTERS.length + 1);
  });

  it('renders material acronyms verbatim rather than through i18n', () => {
    setup();
    const select = screen.getByLabelText('community.print.materialLabel');
    const labels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(labels).toContain('PLA');
    expect(labels).toContain('PETG');
    // Only the escape hatch is ordinary UI copy.
    expect(labels).toContain('community.print.otherOption');
  });

  it('reveals the free-text model field only for "other"', () => {
    setup();
    expect(screen.queryByLabelText('community.print.printerOtherLabel')).toBeNull();

    setup({ draft: { ...DEFAULT_PRINT_DRAFT, printer: 'other' } });
    expect(screen.getAllByLabelText('community.print.printerOtherLabel').length).toBeGreaterThan(0);
  });

  it('pre-selects no fit verdict', () => {
    setup();
    const checked = screen
      .getAllByRole('radio')
      .filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(0);
  });

  it('reports a fit-verdict choice', () => {
    const props = setup();
    fireEvent.click(screen.getByText('community.print.fit.adjusted'));
    expect(props.onDraftChange).toHaveBeenCalledWith({ fitVerdict: 'adjusted' });
  });

  it('splits print time into hours and minutes inputs', () => {
    const props = setup();
    fireEvent.change(screen.getByTestId('print-hours'), { target: { value: '2' } });
    expect(props.onDraftChange).toHaveBeenCalledWith({ printHours: '2' });
    fireEvent.change(screen.getByTestId('print-minutes'), { target: { value: '30' } });
    expect(props.onDraftChange).toHaveBeenCalledWith({ printMinutes: '30' });
  });

  it('shows validation messages only once issues are supplied', () => {
    setup();
    expect(screen.queryByText('community.print.fitRequired')).toBeNull();

    setup({ issues: { fitVerdict: 'required', printer: 'otherRequired' } });
    expect(screen.getByText('community.print.fitRequired')).toBeInTheDocument();
    // The printer error distinguishes "pick one" from "name it".
    expect(screen.getByText('community.print.printerOtherRequired')).toBeInTheDocument();
  });

  it('disables every control while a save is in flight', () => {
    setup({ disabled: true });
    expect(screen.getByLabelText('community.print.printerLabel')).toBeDisabled();
    expect(screen.getByTestId('print-hours')).toBeDisabled();
  });
});
