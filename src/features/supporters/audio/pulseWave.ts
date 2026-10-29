/**
 * Fourier coefficients of a pulse wave with the given duty cycle, for
 * `createPeriodicWave`. A 12.5% or 25% pulse is the hollow, nasal chip sound;
 * 50% is a plain square.
 */
export function pulseCoefficients(
  duty: number,
  harmonics = 48
): { real: Float32Array; imag: Float32Array } {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let n = 1; n <= harmonics; n++) {
    real[n] = (2 / (n * Math.PI)) * Math.sin(2 * Math.PI * n * duty);
    imag[n] = (2 / (n * Math.PI)) * (1 - Math.cos(2 * Math.PI * n * duty));
  }
  return { real, imag };
}
