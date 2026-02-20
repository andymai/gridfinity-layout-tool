/**
 * Keeps a mutable ref in sync with the latest value after each render.
 *
 * Useful for event-bus callbacks and other non-React listeners where
 * the handler needs access to the latest props/state without
 * re-subscribing on every change.
 */

import { useEffect, useRef } from 'react';

export function useLatestRef<T>(value: T): React.RefObject<T> {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  });

  return ref;
}
