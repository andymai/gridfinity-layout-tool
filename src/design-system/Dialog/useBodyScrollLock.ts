import { useEffect } from 'react';

// Body Scroll Lock Hook

// Reference-counted so concurrent dialogs closing in any order can't restore
// stale captured styles (non-LIFO close previously unlocked under an open
// dialog, then re-locked the body permanently).
let bodyScrollLockCount = 0;
let bodyScrollOriginalOverflow = '';
let bodyScrollOriginalPaddingRight = '';

function acquireBodyScrollLock(): void {
  if (bodyScrollLockCount === 0) {
    bodyScrollOriginalOverflow = document.body.style.overflow;
    bodyScrollOriginalPaddingRight = document.body.style.paddingRight;

    // Calculate scrollbar width to prevent layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
  bodyScrollLockCount += 1;
}

function releaseBodyScrollLock(): void {
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = bodyScrollOriginalOverflow;
    document.body.style.paddingRight = bodyScrollOriginalPaddingRight;
  }
}

export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;
    acquireBodyScrollLock();
    return releaseBodyScrollLock;
  }, [isLocked]);
}
