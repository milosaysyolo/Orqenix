// SPDX-License-Identifier: Apache-2.0
// Workbench layout , wraps all tabs with shell + nav + command palette

import { WorkbenchShell } from '@/components/workbench-shell';

export default function WorkbenchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkbenchShell>{children}</WorkbenchShell>;
}
