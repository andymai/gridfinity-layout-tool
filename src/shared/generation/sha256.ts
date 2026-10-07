/**
 * SHA-256 for naming mesh files by content.
 *
 * `crypto.subtle` is a secure-context API: it is missing over plain HTTP on a
 * LAN address, which is how a self-hosted instance is often opened. The
 * pure-JS digest below runs only there, and must agree with WebCrypto byte for
 * byte, since both name the same files.
 */

let roundConstants: Uint32Array | null = null;
let initialHash: Uint32Array | null = null;

/** FIPS 180-4 constants: fractional bits of the cube and square roots of the first 64 primes. */
function constants(): [Uint32Array, Uint32Array] {
  if (roundConstants && initialHash) return [roundConstants, initialHash];
  const k = new Uint32Array(64);
  const h = new Uint32Array(8);
  for (let n = 2, found = 0; found < 64; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) prime = false;
    if (!prime) continue;
    if (found < 8) h[found] = (Math.sqrt(n) * 2 ** 32) | 0;
    k[found++] = (Math.cbrt(n) * 2 ** 32) | 0;
  }
  roundConstants = k;
  initialHash = h;
  return [k, h];
}

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

export function sha256(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const [k, h0] = constants();
  const hash = h0.slice();
  const padded = new Uint8Array(((bytes.length + 72) >> 6) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bytes.length / 2 ** 29));
  view.setUint32(padded.length - 4, bytes.length * 8);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15];
      const b = w[i - 2];
      w[i] =
        w[i - 16] +
        (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) +
        w[i - 7] +
        (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10));
    }
    let [a, b, c, d, e, f, g, hh] = hash;
    for (let i = 0; i < 64; i++) {
      const t1 =
        (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + k[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    hash[0] += a;
    hash[1] += b;
    hash[2] += c;
    hash[3] += d;
    hash[4] += e;
    hash[5] += f;
    hash[6] += g;
    hash[7] += hh;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  hash.forEach((word, i) => outView.setUint32(i * 4, word));
  return out;
}

/** Lowercase hex SHA-256 of `bytes`. */
export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const subtle = globalThis.crypto.subtle;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- missing outside a secure context
  const digest = subtle ? new Uint8Array(await subtle.digest('SHA-256', bytes)) : sha256(bytes);
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}
