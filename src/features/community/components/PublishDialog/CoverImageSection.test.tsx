import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ok, err } from '@/core/result';
import { CoverImageSection } from './CoverImageSection';
import { fetchPrints, setCoverPhoto } from '../../api/printsClient';

vi.mock('../../api/printsClient', () => ({
  fetchPrints: vi.fn(),
  setCoverPhoto: vi.fn(),
}));

const mockFetchPrints = vi.mocked(fetchPrints);
const mockSetCover = vi.mocked(setCoverPhoto);

function minePage(photos: string[]) {
  return ok({
    items: [],
    mine: { photos } as never,
    nextCursor: null,
  } as never);
}

describe('CoverImageSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains the path to a real photo when the owner has posted no print', async () => {
    mockFetchPrints.mockResolvedValue(minePage([]));
    render(<CoverImageSection designId="Design123456" currentCoverUrl="" />);
    expect(
      await screen.findByText(
        'This design’s card shows a render. Print it and post a photo on its page to use a real photo instead.'
      )
    ).toBeInTheDocument();
  });

  it('offers the render plus each of the owner’s print photos', async () => {
    mockFetchPrints.mockResolvedValue(minePage(['https://blob/a.webp', 'https://blob/b.webp']));
    render(<CoverImageSection designId="Design123456" currentCoverUrl="" />);
    expect(await screen.findByText('Use the render')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('marks the current cover as selected', async () => {
    mockFetchPrints.mockResolvedValue(minePage(['https://blob/a.webp']));
    render(<CoverImageSection designId="Design123456" currentCoverUrl="https://blob/a.webp" />);
    await screen.findByText('Use the render');
    expect(screen.getByText('Use the render')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByLabelText('Use this photo')).toHaveAttribute('aria-checked', 'true');
  });

  it('promotes a chosen photo and reflects the server’s answer', async () => {
    mockFetchPrints.mockResolvedValue(minePage(['https://blob/a.webp']));
    mockSetCover.mockResolvedValue(ok({ coverPhotoUrl: 'https://blob/a.webp' }));
    render(<CoverImageSection designId="Design123456" currentCoverUrl="" />);
    fireEvent.click(await screen.findByLabelText('Use this photo'));
    expect(mockSetCover).toHaveBeenCalledWith('Design123456', 'https://blob/a.webp');
    await waitFor(() =>
      expect(screen.getByLabelText('Use this photo')).toHaveAttribute('aria-checked', 'true')
    );
  });

  it('clears back to the render with an explicit null', async () => {
    mockFetchPrints.mockResolvedValue(minePage(['https://blob/a.webp']));
    mockSetCover.mockResolvedValue(ok({ coverPhotoUrl: '' }));
    render(<CoverImageSection designId="Design123456" currentCoverUrl="https://blob/a.webp" />);
    fireEvent.click(await screen.findByText('Use the render'));
    expect(mockSetCover).toHaveBeenCalledWith('Design123456', null);
  });

  it('reports a failed promotion without losing the choices', async () => {
    mockFetchPrints.mockResolvedValue(minePage(['https://blob/a.webp']));
    mockSetCover.mockResolvedValue(err({ kind: 'network' }));
    render(<CoverImageSection designId="Design123456" currentCoverUrl="" />);
    fireEvent.click(await screen.findByLabelText('Use this photo'));
    expect(
      await screen.findByText('Could not change the card image. Try again.')
    ).toBeInTheDocument();
    expect(screen.getByText('Use the render')).toBeInTheDocument();
  });

  it('degrades quietly when the prints fetch fails', async () => {
    // The section is an enhancement; the design updates fine without it.
    mockFetchPrints.mockResolvedValue(err({ kind: 'server' }));
    render(<CoverImageSection designId="Design123456" currentCoverUrl="" />);
    expect(await screen.findByText(/card shows a render/)).toBeInTheDocument();
  });
});
