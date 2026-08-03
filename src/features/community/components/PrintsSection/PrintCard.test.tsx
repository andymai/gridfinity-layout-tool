// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CommunityPrint } from '@/shared/types/communityPrint';
import { PrintCard } from './PrintCard';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function print(overrides: Partial<CommunityPrint> = {}): CommunityPrint {
  return {
    id: 'abc123def456:aaa',
    designId: 'abc123def456',
    authorPublicId: 'a'.repeat(32),
    authorName: 'Casey',
    photos: [],
    settings: {
      material: 'pla',
      nozzleMm: 0.4,
      layerHeightMm: 0.2,
      printMinutes: 145,
      printer: 'bambu-p1s',
    },
    fitVerdict: 'as-designed',
    note: '',
    createdAt: 1,
    updatedAt: 1,
    status: 'live',
    ...overrides,
  };
}

describe('PrintCard', () => {
  it('renders the curated printer label', () => {
    render(<PrintCard print={print()} isMine={false} />);
    expect(screen.getByText('Bambu Lab P1S')).toBeInTheDocument();
  });

  it('renders the free-text model for an "other" printer', () => {
    render(
      <PrintCard
        print={print({
          settings: { ...print().settings, printer: 'other', printerOther: 'Toolchanger' },
        })}
        isMine={false}
      />
    );
    expect(screen.getByText('Toolchanger')).toBeInTheDocument();
  });

  it('falls back to the raw id for a retired printer', () => {
    render(
      <PrintCard
        print={print({ settings: { ...print().settings, printer: 'gone-9000' } })}
        isMine={false}
      />
    );
    // An old record keeps its machine rather than losing it.
    expect(screen.getByText('gone-9000')).toBeInTheDocument();
  });

  it.each([['as-designed' as const], ['adjusted' as const], ['did-not-fit' as const]])(
    'badges the %s verdict',
    (fitVerdict) => {
      render(<PrintCard print={print({ fitVerdict })} isMine={false} />);
      expect(screen.getByTestId(`print-verdict-${fitVerdict}`)).toBeInTheDocument();
    }
  );

  it('omits filament when it was not reported', () => {
    const { container } = render(<PrintCard print={print()} isMine={false} />);
    expect(container.textContent).not.toContain('community.prints.filament');
  });

  it('shows filament when it was reported', () => {
    const { container } = render(
      <PrintCard
        print={print({ settings: { ...print().settings, filamentGrams: 18 } })}
        isMine={false}
      />
    );
    expect(container.textContent).toContain('community.prints.filament');
  });

  it('renders photos with an attributed alt text', () => {
    render(<PrintCard print={print({ photos: ['https://blob.example/a.webp'] })} isMine={false} />);
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'community.prints.photoAlt');
  });

  it("offers reporting on someone else's print", () => {
    const onReport = vi.fn();
    render(<PrintCard print={print()} isMine={false} onReport={onReport} />);
    fireEvent.click(screen.getByTestId(`print-report-${'a'.repeat(32)}`));
    expect(onReport).toHaveBeenCalled();
  });

  it('never offers reporting on your own print', () => {
    render(<PrintCard print={print()} isMine onReport={vi.fn()} />);
    expect(screen.queryByTestId(`print-report-${'a'.repeat(32)}`)).toBeNull();
    expect(screen.getByText('community.prints.yours')).toBeInTheDocument();
  });

  it('renders a note when there is one', () => {
    render(<PrintCard print={print({ note: 'scaled 2 percent' })} isMine={false} />);
    expect(screen.getByText('scaled 2 percent')).toBeInTheDocument();
  });

  describe('cover promotion', () => {
    const withPhoto = () => print({ photos: ['https://blob.example/a.webp'] });

    it('offers no promotion to a non-owner', () => {
      render(<PrintCard print={withPhoto()} isMine={false} />);
      // The gallery grid is the most public surface in the app; only the
      // design's owner may put an image on it.
      expect(screen.queryByTestId('print-promote-0')).toBeNull();
    });

    it('lets the owner promote a photo', () => {
      const onPromoteCover = vi.fn();
      render(<PrintCard print={withPhoto()} isMine={false} onPromoteCover={onPromoteCover} />);
      fireEvent.click(screen.getByTestId('print-promote-0'));
      expect(onPromoteCover).toHaveBeenCalledWith('https://blob.example/a.webp');
    });

    it('labels the current cover instead of offering it again', () => {
      render(
        <PrintCard
          print={withPhoto()}
          isMine={false}
          onPromoteCover={vi.fn()}
          coverPhotoUrl="https://blob.example/a.webp"
        />
      );
      expect(screen.queryByTestId('print-promote-0')).toBeNull();
      expect(screen.getByText('community.prints.coverCurrent')).toBeInTheDocument();
    });
  });
});
