// Catches uncaught errors from any routed page so a thrown render
// doesn't blank the whole app. The header stays mounted (it's outside
// this boundary, in Layout) and the user can navigate to a different
// route or reload.
//
// Class component because React's error-boundary API still requires
// componentDidCatch / getDerivedStateFromError. We don't have a hook
// equivalent in v19.

import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack);
    // Sentry.captureException is a no-op when Sentry.init wasn't run
    // (no DSN), so this is safe in local dev and CI.
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="frame mt-12 text-center">
        <h1 className="font-serif text-2xl font-bold text-ink">Something went wrong.</h1>
        <p className="mt-3 font-sans text-sm text-muted">
          The app hit an unexpected error. Refresh to try again.
        </p>
        <button type="button" onClick={this.handleReload} className="btn-primary mt-6">
          Reload
        </button>
      </div>
    );
  }
}
