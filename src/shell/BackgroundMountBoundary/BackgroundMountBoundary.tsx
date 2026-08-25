import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { captureException } from '@/shared/analytics/posthog';

interface Props {
  children: ReactNode;
  /** Which mount this guards, for telemetry. */
  readonly mountName: string;
}

interface State {
  hasError: boolean;
}

/**
 * Contains a failure in a lazy mount that renders no UI of its own.
 *
 * `<Suspense>` isolates such a mount while its chunk LOADS, but not if the
 * chunk never arrives: a rejected import propagates past Suspense to the
 * nearest error boundary, which for these mounts was the root one. So a
 * stale-deploy chunk miss on an invisible side-effect mount took the whole app
 * down with it, including for someone opening a shared layout link.
 *
 * Renders nothing on failure, matching what these mounts render when they
 * work, so the app degrades by losing that one side effect rather than
 * crashing. Still reports, under its own `boundary` tag so it stays
 * distinguishable from a real root crash.
 *
 * Only for mounts whose output is `null`. Anything the user is meant to see
 * belongs in {@link PanelErrorBoundary}, which offers a retry.
 */
export class BackgroundMountBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureException(error, {
      boundary: 'background-mount',
      mountName: this.props.mountName,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}
