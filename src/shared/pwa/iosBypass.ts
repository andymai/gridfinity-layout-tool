/**
 * Detect iOS Safari running as an installed home-screen PWA. SW lifecycle on
 * this surface is unreliable in well-known ways: `controllerchange` doesn't
 * always fire, `registration.waiting` is sometimes null when an update exists,
 * and iOS aggressively kills offscreen iframes when the PWA backgrounds.
 *
 * Treating this surface as "smoke gate disabled" trades the gate's safety net
 * for the user's app actually working. Logged via PostHog so we can measure
 * exposure if the gate ever becomes a hard requirement.
 */
export function isIosStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;

  // iOS Safari historically sets `navigator.standalone` for home-screen apps.
  // Modern iOS versions also honor the standard `display-mode: standalone`.
  const navStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  const matchesStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;

  // UA sniffing for iOS — `iPad` UA on iPadOS 13+ reports as "MacIntel" with
  // touch points >0. Both checks together cover iPhone/iPad PWAs.
  const ua = navigator.userAgent;
  const isIphoneOrIpod = /iPhone|iPod/.test(ua);
  const isIpadOs13Plus =
    navigator.platform === 'MacIntel' &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1;
  const isIos = isIphoneOrIpod || isIpadOs13Plus;

  return isIos && (navStandalone || matchesStandalone);
}
