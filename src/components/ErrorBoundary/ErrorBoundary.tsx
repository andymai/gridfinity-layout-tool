import { Component } from 'react';
import type { ReactNode } from 'react';
import { captureException, track3DRenderError } from '@/shared/analytics/posthog';
import { getStaticTranslation } from '@/i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
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
      boundary: 'root',
      componentStack: errorInfo.componentStack,
    });
    track3DRenderError('root', error.message);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleClearStorage = () => {
    try {
      localStorage.removeItem('gridfinity-layout');
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-surface p-8" role="alert">
          <div className="max-w-lg text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-error-muted flex items-center justify-center">
              <svg
                className="w-8 h-8 text-error"
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
            {/* eslint-disable i18next/no-literal-string -- translation keys for getStaticTranslation */}
            <h1 className="text-xl font-semibold mb-2 text-content">
              {getStaticTranslation('errorBoundary.heading')}
            </h1>
            <p className="text-content-secondary mb-2">
              {getStaticTranslation('errorBoundary.description')}
            </p>
            <p className="text-sm text-content-tertiary mb-6">
              {getStaticTranslation('errorBoundary.hint')}
            </p>
            {/* eslint-enable i18next/no-literal-string */}
            {this.state.error && (
              <pre className="text-left text-xs rounded-lg p-3 mb-6 overflow-auto max-h-32 text-error bg-surface-elevated border border-stroke-subtle">
                {this.state.error.message}
              </pre>
            )}
            {/* eslint-disable i18next/no-literal-string -- translation keys */}
            <div className="flex gap-3 justify-center">
              <button onClick={this.handleReset} className="btn btn-secondary">
                {getStaticTranslation('errorBoundary.tryAgain')}
              </button>
              <button onClick={this.handleClearStorage} className="btn btn-danger">
                {getStaticTranslation('errorBoundary.resetAppData')}
              </button>
            </div>
            {/* eslint-enable i18next/no-literal-string */}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
