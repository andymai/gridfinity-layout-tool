// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ok, err } from '@/core/result';
import { PrintPhotoPicker } from './PrintPhotoPicker';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const prepare = vi.hoisted(() => vi.fn());
vi.mock('../../utils/printPhoto', () => ({ preparePrintPhoto: prepare }));

function file(name = 'a.jpg'): File {
  return new File([new Uint8Array(1)], name, { type: 'image/jpeg' });
}

function setup(overrides: Partial<React.ComponentProps<typeof PrintPhotoPicker>> = {}) {
  const props = {
    photos: [],
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    error: null,
    onError: vi.fn(),
    ...overrides,
  };
  render(<PrintPhotoPicker {...props} />);
  return props;
}

beforeEach(() => {
  vi.clearAllMocks();
  prepare.mockResolvedValue(
    ok({
      dataUrl: 'data:image/webp;base64,AAA',
      width: 1,
      height: 1,
      bytes: 1,
      thumbDataUrl: null,
    })
  );
});

describe('PrintPhotoPicker', () => {
  it('adds a prepared photo', async () => {
    const props = setup();
    fireEvent.change(screen.getByTestId('print-photo-input'), { target: { files: [file()] } });
    await waitFor(() =>
      expect(props.onAdd).toHaveBeenCalledWith('data:image/webp;base64,AAA', null)
    );
  });

  it('passes the browsing-sized copy through to the store', async () => {
    prepare.mockResolvedValue(
      ok({
        dataUrl: 'data:image/webp;base64,AAA',
        width: 1200,
        height: 900,
        bytes: 1,
        thumbDataUrl: 'data:image/webp;base64,TTT',
      })
    );
    const props = setup();
    fireEvent.change(screen.getByTestId('print-photo-input'), { target: { files: [file()] } });
    await waitFor(() =>
      expect(props.onAdd).toHaveBeenCalledWith(
        'data:image/webp;base64,AAA',
        'data:image/webp;base64,TTT'
      )
    );
  });

  it('surfaces a preparation failure instead of adding', async () => {
    prepare.mockResolvedValue(err({ kind: 'irreducible' }));
    const props = setup();
    fireEvent.change(screen.getByTestId('print-photo-input'), { target: { files: [file()] } });
    await waitFor(() =>
      expect(props.onError).toHaveBeenCalledWith('community.print.photoError.irreducible')
    );
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it('takes only the remaining slots from an oversized selection', async () => {
    const props = setup({
      photos: [
        { kind: 'new', url: 'data:a' },
        { kind: 'new', url: 'data:b' },
      ],
    });
    fireEvent.change(screen.getByTestId('print-photo-input'), {
      target: { files: [file('a.jpg'), file('b.jpg'), file('c.jpg'), file('d.jpg')] },
    });
    // Two slots left, so a four-file pick takes two rather than failing.
    await waitFor(() => expect(props.onAdd).toHaveBeenCalledTimes(2));
  });

  it('hides the add button once the cap is reached', () => {
    setup({
      photos: [
        { kind: 'new', url: 'data:a' },
        { kind: 'new', url: 'data:b' },
        { kind: 'new', url: 'data:c' },
        { kind: 'new', url: 'data:d' },
      ],
    });
    expect(screen.queryByTestId('print-photo-add')).toBeNull();
  });

  it('removes by position', () => {
    const props = setup({ photos: [{ kind: 'kept', url: 'https://blob.example/a.webp' }] });
    fireEvent.click(screen.getByTestId('print-photo-remove-0'));
    expect(props.onRemove).toHaveBeenCalledWith(0);
  });

  it('renders an error message as an alert', () => {
    setup({ error: 'nope' });
    expect(screen.getByRole('alert')).toHaveTextContent('nope');
  });
});
