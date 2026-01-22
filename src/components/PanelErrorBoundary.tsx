import { Component } from 'react';
import type { ReactNode } from 'react';
import { captureException } from '@/utils/analytics';

interface Props {
  children: ReactNode;
  /** Name of the panel for display in error message */
  panelName: string;
  /** Optional callback when error occurs */
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * A lightweight error boundary for wrapping UI panels.
 * Unlike the top-level ErrorBoundary, this shows an inline error
 * message and allows the rest of the app to continue working.
 */
export class PanelErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Report error to PostHog for monitoring
    captureException(error, {
      boundary: 'panel',
      panelName: this.props.panelName,
      componentStack: errorInfo.componentStack,
    });
    this.props.onError?.(error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center h-full min-h-[200px]">
          <div className="w-12 h-12 mb-3 rounded-full bg-error/20 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-error"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-content mb-1">{this.props.panelName} Error</h3>
          <p className="text-xs text-content-secondary mb-3 max-w-[200px]">
            Something went wrong loading this panel.
          </p>
          {this.state.error && (
            <p className="text-xs text-error mb-3 max-w-[200px] break-words">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleRetry}
            className="px-3 py-1.5 text-xs font-medium bg-surface-secondary hover:bg-surface-elevated rounded transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
