// SPDX-License-Identifier: Apache-2.0

'use client';

export function RunQueryButton(): React.ReactElement {
  return (
    <button
      type="button"
      className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
      onClick={() => {
        window.location.href = '/api/query/demo';
      }}
    >
      Run Query
    </button>
  );
}
