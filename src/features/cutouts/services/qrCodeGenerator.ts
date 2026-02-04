/**
 * QR Code Generator
 *
 * Lightweight QR code generation using the QR Code API service.
 * This avoids bundling a large QR code library and keeps the bundle size small.
 */

/**
 * QR code size options.
 */
export type QRCodeSize = 'small' | 'medium' | 'large';

/**
 * Size mappings in pixels.
 */
const SIZE_MAP: Record<QRCodeSize, number> = {
  small: 150,
  medium: 200,
  large: 300,
};

/**
 * Generate a QR code image URL using the QR Server API.
 *
 * This is a free, reliable API that doesn't require any API key.
 * It's used by many projects and has high uptime.
 *
 * @param data - The data to encode in the QR code
 * @param size - The size of the QR code image
 * @returns URL to the QR code image
 */
export function generateQRCodeUrl(data: string, size: QRCodeSize = 'medium'): string {
  const pixels = SIZE_MAP[size];
  const encoded = encodeURIComponent(data);

  // Use the free QR Server API (https://goqr.me/api/)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${pixels}x${pixels}&data=${encoded}&margin=10&format=svg`;
}

/**
 * Generate a QR code as a data URL by fetching from the API.
 * This allows the QR code to be used offline after initial load.
 *
 * @param data - The data to encode in the QR code
 * @param size - The size of the QR code image
 * @returns Promise resolving to a data URL
 */
export async function generateQRCodeDataUrl(
  data: string,
  size: QRCodeSize = 'medium'
): Promise<string> {
  const url = generateQRCodeUrl(data, size);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to generate QR code: ${response.status}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to data URL'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}
