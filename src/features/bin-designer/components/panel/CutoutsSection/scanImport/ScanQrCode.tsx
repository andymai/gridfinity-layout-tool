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
  // Tie the generated image to the url it was made for, so a url change never
  // briefly shows the previous session's QR.
  const [generated, setGenerated] = useState<{ url: string; dataUrl: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Read through a function so control-flow analysis keeps it a live boolean
    // across the await (it is flipped on cleanup).
    const isCancelled = (): boolean => cancelled;
    void (async () => {
      try {
        const qrcode = await import('qrcode');
        const out = await qrcode.toDataURL(url, { margin: 1, width: size * 2 });
        if (!isCancelled()) setGenerated({ url, dataUrl: out });
      } catch {
        // Leave the QR blank; the dialog still shows the link below it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  const dataUrl = generated?.url === url ? generated.dataUrl : null;

  return (
    <div
      className="flex items-center justify-center rounded-md border border-stroke-subtle bg-white p-2"
      style={{ width: size + 16, height: size + 16 }}
    >
      {dataUrl && <img src={dataUrl} width={size} height={size} alt={alt} />}
    </div>
  );
}
