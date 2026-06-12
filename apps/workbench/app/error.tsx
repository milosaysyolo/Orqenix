// SPDX-License-Identifier: Apache-2.0
// Root error boundary for Workbench

'use client';

import { useEffect } from 'react';
import { Button } from '@orqenix/ui-primitives';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to local diagnostics (Workbench has no remote telemetry by default)
    console.error('Workbench error:', error);
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-foreground mb-3">
          Workbench encountered an error
        </h1>
        <p className="text-muted-foreground mb-6">
          {error.message ||
            'An unexpected error occurred. Please report this if it persists.'}
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="default">
            Try Again
          </Button>
          <Button
            onClick={() => (window.location.href = '/')}
            variant="outline"
          >
            Go Home
          </Button>
        </div>
        {error.digest && (
          <p className="text-xs text-muted-foreground mt-6">
            Error ID: <code className="font-mono">{error.digest}</code>
          </p>
        )}
      </div>
    </div>
  );
}
