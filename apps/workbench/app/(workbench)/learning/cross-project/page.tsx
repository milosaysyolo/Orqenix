// SPDX-License-Identifier: Apache-2.0
// Workbench , Cross-project learning page (Pro feature)

"use client";

import { useEffect, useState } from "react";
import { CrossProjectCandidateCard } from "../../../../components/cross-project-candidate-card";
import { probeCrossProjectFederation } from "../../../../lib/cross-project-provider";
import type { CrossProjectCapability } from "../../../../lib/cross-project-provider";

export default function CrossProjectPage() {
  const [capability, setCapability] = useState<CrossProjectCapability>({
    available: false,
    reason: "Probing...",
  });

  useEffect(() => {
    probeCrossProjectFederation().then(setCapability);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cross-Project Learning</h1>
        <p className="text-sm text-muted-foreground">
          Discover patterns shared across your projects
        </p>
      </div>
      <CrossProjectCandidateCard capability={capability} />
    </div>
  );
}
