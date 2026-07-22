// SPDX-License-Identifier: Apache-2.0

export default function WorkbenchLoading(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status">
      <div className="text-muted-foreground text-sm">Loading…</div>
    </div>
  );
}
