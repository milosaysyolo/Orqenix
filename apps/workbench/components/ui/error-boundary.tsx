'use client';

import * as React from 'react';

interface Props {
  children: React.ReactNode;
  name?: string;
}

interface State {
  error: Error | null;
}

/**
 * Shared ErrorBoundary — catches render errors in its subtree and shows a
 * fallback displaying the route group name + "try again" button.
 *
 * Usage:
 *   <ErrorBoundary name="Dashboard">
 *     <DashboardPage />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary:${this.props.name ?? 'section'}]`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-[600px] px-6 py-16 text-center">
          <div className="text-[48px] text-[var(--rust)] opacity-40">{'\u26A0'}</div>
          <h1 className="font-serif text-[22px] font-semibold tracking-tight text-[var(--ink)]">
            Error{this.props.name ? ` in ${this.props.name}` : ''}
          </h1>
          <p className="mt-2 font-mono text-[12px] text-[var(--dim)]">
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-6 rounded-[9px] border border-[var(--rust)] bg-[color-mix(in_oklab,var(--rust)_8%,transparent)] px-4 py-2 font-mono text-[12px] font-bold text-[var(--rust)] hover:bg-[color-mix(in_oklab,var(--rust)_14%,transparent)]"
          >
            try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
