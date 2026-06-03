import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { captureException, track3DRenderError } from '@/shared/analytics/posthog';
import { downloadArchive } from '@/core/storage';
import { useLibraryStore } from '@/core/store/library';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { getStaticTranslation } from '@/i18n';

interface Props {
  children: ReactNode;
}

type BackupState = 'idle' | 'working' | 'done' | 'error';

interface State {
  hasError: boolean;
  error: Error | null;
  backupState: BackupState;
  /** Whether the layout edit history had an undoable step when the error was caught. */
  canUndo: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, backupState: 'idle', canUndo: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Read undo availability imperatively (store lives outside the React tree).
    // Guarded because an early-boot crash may run this before the store exists,
    // and getDerivedStateFromError must never throw.
    let canUndo: boolean;
    try {
      canUndo = useHistoryStore.getState().canUndo;
    } catch {
      canUndo = false;
    }
    return { hasError: true, error, canUndo };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureException(error, {
      boundary: 'root',
      componentStack: errorInfo.componentStack,
    });
    track3DRenderError('root', error.message);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, backupState: 'idle', canUndo: false });
  };

  // `undo()` dispatches synchronously, so the layout store is restored before
  // handleReset re-mounts the children. Recovers without a reload or data loss
  // when the crash came from the last edit (the change stays redoable).
  handleUndo = () => {
    try {
      useHistoryStore.getState().undo();
    } catch {
      // Fall through to a plain retry if undo itself throws.
    }
    this.handleReset();
  };

  // Intentionally no "reset" button on the crash screen — wiping data is
  // reachable only from Settings → Storage, behind a confirm.
  handleDownloadBackup = () => {
    this.setState({ backupState: 'working' });
    void downloadArchive(useLibraryStore.getState().library)
      .then(() => this.setState({ backupState: 'done' }))
      .catch(() => this.setState({ backupState: 'error' }));
  };

  render() {
    if (this.state.hasError) {
      const { backupState, canUndo, error } = this.state;
      return (
        <div
          className="h-screen flex items-center justify-center bg-surface p-8"
          role="alert"
          aria-live="assertive"
        >
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
            {error && (
              <pre className="text-left text-xs rounded-lg p-3 mb-6 overflow-auto max-h-32 text-error bg-surface-elevated border border-stroke-subtle">
                {error.message}
              </pre>
            )}
            {/* eslint-disable i18next/no-literal-string -- translation keys */}
            <div className="flex flex-wrap gap-3 justify-center">
              <button onClick={this.handleReset} className="btn btn-secondary">
                {getStaticTranslation('errorBoundary.tryAgain')}
              </button>
              {canUndo && (
                <button onClick={this.handleUndo} className="btn btn-secondary">
                  {getStaticTranslation('errorBoundary.undoLastChange')}
                </button>
              )}
              <button
                onClick={this.handleDownloadBackup}
                className="btn btn-primary"
                disabled={backupState === 'working'}
              >
                {getStaticTranslation('errorBoundary.downloadBackup')}
              </button>
            </div>
            {backupState === 'done' && (
              <p className="text-sm text-success mt-4">
                {getStaticTranslation('errorBoundary.backupDone')}
              </p>
            )}
            {backupState === 'error' && (
              <p className="text-sm text-error mt-4">
                {getStaticTranslation('errorBoundary.backupError')}
              </p>
            )}
            {/* eslint-enable i18next/no-literal-string */}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
