// SPDX-License-Identifier: Apache-2.0
// Workbench , Cross-project candidate card (Pro feature — shows upgrade prompt if absent)

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@orqenix/ui-primitives';
import type { CrossProjectCapability } from '../lib/cross-project-provider';

interface CrossProjectCandidateCardProps {
  capability: CrossProjectCapability;
}

export function CrossProjectCandidateCard({ capability }: CrossProjectCandidateCardProps) {
  if (!capability.available) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cross-Project Federation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {capability.reason}
            </p>
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
              Upgrade to Orqenix Pro to detect and share learning patterns across projects.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cross-Project Candidates</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Cross-project federation detected. Candidates will appear here.
        </p>
      </CardContent>
    </Card>
  );
}
