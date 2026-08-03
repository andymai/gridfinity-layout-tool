// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isErr, isOk } from '@/core/result';
import {
  COMMUNITY_PRINT_PHOTO_MAX_BYTES,
  COMMUNITY_PRINT_PHOTO_MAX_EDGE_PX,
} from '@/shared/types/communityPrint';
import { PRINT_PHOTO_MAX_SOURCE_BYTES, preparePrintPhoto } from './printPhoto';

function imageFile(bytes = 1000, type = 'image/jpeg'): File {
  const file = new File([new Uint8Array(1)], 'photo.jpg', { type });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

/** Records every drawImage target so the scale ladder is observable. */
const drawn: Array<{ width: number; height: number }> = [];
/** Byte size the next toBlob call reports, so the ladder can be driven. */
let blobSizes: number[] = [];
let blobCalls: number[] = [];

function stubCanvas(): void {
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'canvas') {
      return Object.create(HTMLElement.prototype) as HTMLElement;
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: (_img: unknown, _x: number, _y: number, width: number, height: number) => {
          drawn.push({ width, height });
        },
      }),
      toBlob: (cb: (blob: Blob | null) => void, _type: string, quality: number) => {
        blobCalls.push(quality);
        const size = blobSizes.shift() ?? 1000;
        cb(size < 0 ? null : ({ size } as Blob));
      },
    };
    return canvas as unknown as HTMLElement;
  });
}

beforeEach(() => {
  drawn.length = 0;
  blobSizes = [];
  blobCalls = [];
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 3000, height: 2000, close: vi.fn() }))
  );
  vi.stubGlobal(
    'FileReader',
    class {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        this.result = 'data:image/webp;base64,QUJD';
        this.onload?.();
      }
    }
  );
  stubCanvas();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('input rejection', () => {
  it('rejects a non-image file without decoding it', async () => {
    const result = await preparePrintPhoto(imageFile(1000, 'application/pdf'));
    expect(isErr(result) && result.error.kind).toBe('notAnImage');
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it('rejects a source over the size ceiling', async () => {
    const result = await preparePrintPhoto(imageFile(PRINT_PHOTO_MAX_SOURCE_BYTES + 1));
    expect(isErr(result) && result.error.kind).toBe('sourceTooLarge');
  });

  it('reports a decode failure rather than throwing', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('unsupported');
      })
    );
    const result = await preparePrintPhoto(imageFile());
    expect(isErr(result) && result.error.kind).toBe('decodeFailed');
  });
});

describe('orientation', () => {
  it('decodes with the EXIF orientation applied', async () => {
    blobSizes = [1000];
    await preparePrintPhoto(imageFile());
    // Without `from-image` a portrait phone photo bakes in sideways, since
    // the re-encode then discards the tag that would have corrected it.
    expect(createImageBitmap).toHaveBeenCalledWith(expect.anything(), {
      imageOrientation: 'from-image',
    });
  });
});

describe('downscaling', () => {
  it('fits the longest edge to the cap, preserving aspect ratio', async () => {
    blobSizes = [1000];
    const result = await preparePrintPhoto(imageFile());
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.width).toBe(COMMUNITY_PRINT_PHOTO_MAX_EDGE_PX);
    expect(result.value.height).toBe(800);
    expect(drawn[0]).toEqual({ width: 1200, height: 800 });
  });

  it('leaves an already-small image at its own size', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 400, height: 300, close: vi.fn() }))
    );
    blobSizes = [1000];
    const result = await preparePrintPhoto(imageFile());
    expect(isOk(result) && result.value.width).toBe(400);
  });
});

describe('the quality ladder', () => {
  it('accepts the first encode that fits', async () => {
    blobSizes = [1000];
    const result = await preparePrintPhoto(imageFile());
    expect(isOk(result)).toBe(true);
    expect(blobCalls).toEqual([0.82]);
  });

  it('steps quality down until the encode fits the byte cap', async () => {
    const tooBig = COMMUNITY_PRINT_PHOTO_MAX_BYTES + 1;
    blobSizes = [tooBig, tooBig, 1000];
    const result = await preparePrintPhoto(imageFile());
    expect(isOk(result) && result.value.bytes).toBe(1000);
    expect(blobCalls).toEqual([0.82, 0.7, 0.6]);
  });

  it('falls back to shrinking once the quality ladder is exhausted', async () => {
    const tooBig = COMMUNITY_PRINT_PHOTO_MAX_BYTES + 1;
    // Five failures exhausts the quality ladder at full scale, then the
    // second scale step succeeds immediately.
    blobSizes = [tooBig, tooBig, tooBig, tooBig, tooBig, 1000];
    const result = await preparePrintPhoto(imageFile());
    expect(isOk(result)).toBe(true);
    // Dropping resolution beats heavy quantisation at the same file size.
    expect(drawn[1]).toEqual({ width: 960, height: 640 });
  });

  it('gives up with irreducible when nothing fits at any scale', async () => {
    blobSizes = Array.from({ length: 40 }, () => COMMUNITY_PRINT_PHOTO_MAX_BYTES + 1);
    const result = await preparePrintPhoto(imageFile());
    expect(isErr(result) && result.error.kind).toBe('irreducible');
  });

  it('reports an encode failure when the browser produces no WebP at all', async () => {
    blobSizes = Array.from({ length: 40 }, () => -1);
    const result = await preparePrintPhoto(imageFile());
    // Distinct from irreducible: nothing encoded, so it is not about size.
    expect(isErr(result) && result.error.kind).toBe('encodeFailed');
  });
});

describe('output', () => {
  it('returns a WebP data URL ready for upload', async () => {
    blobSizes = [1000];
    const result = await preparePrintPhoto(imageFile());
    expect(isOk(result) && result.value.dataUrl).toBe('data:image/webp;base64,QUJD');
  });

  it('releases the decoded bitmap', async () => {
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 800, height: 600, close }))
    );
    blobSizes = [1000];
    await preparePrintPhoto(imageFile());
    expect(close).toHaveBeenCalled();
  });
});
