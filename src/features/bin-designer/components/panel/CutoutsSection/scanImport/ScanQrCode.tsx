/**
 * Renders a URL as a QR code. The `qrcode` library is dynamically imported so
 * it stays out of the main bundle and only loads when the scan dialog opens.
 */

import { useEffect, useState } from 'react';

interface ScanQrCodeProps {
  readonly url: string;
  readonly size?: number;
  readonly alt: string;
}

export function ScanQrCode({ url, size = 192, alt }: ScanQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Read through a function so control-flow analysis keeps it a live boolean
    // across the await (it is flipped on cleanup).
    const isCancelled = (): boolean => cancelled;
    void (async () => {
      try {
        const qrcode = await import('qrcode');
        const out = await qrcode.toDataURL(url, { margin: 1, width: size * 2 });
        if (!isCancelled()) setDataUrl(out);
      } catch {
        // Leave the QR blank; the dialog still shows the copyable link.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  return (
    <div
      className="flex items-center justify-center rounded-md border border-stroke-subtle bg-white p-2"
      style={{ width: size + 16, height: size + 16 }}
    >
      {dataUrl && <img src={dataUrl} width={size} height={size} alt={alt} />}
    </div>
  );
}
