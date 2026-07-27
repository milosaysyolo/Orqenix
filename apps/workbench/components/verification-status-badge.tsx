// SPDX-License-Identifier: Apache-2.0
// Workbench , Verification status badge

"use client";

import * as React from "react";
import { AlertTriangle, Beaker, ShieldCheck, Store } from "lucide-react";
import { Badge } from "@orqenix/ui-primitives";

export type VerificationStatus = "unverified" | "replay_tested" | "verified" | "marketplace-ready";

export function VerificationStatusBadge({
  status,
}: {
  status: VerificationStatus;
}): React.ReactElement {
  switch (status) {
    case "unverified":
      return (
        <Badge variant="outline" className="gap-1">
          <AlertTriangle className="w-3 h-3" aria-hidden /> Unverified
        </Badge>
      );
    case "replay_tested":
      return (
        <Badge variant="secondary" className="gap-1">
          <Beaker className="w-3 h-3" aria-hidden /> Replay-tested
        </Badge>
      );
    case "verified":
      return (
        <Badge variant="default" className="gap-1">
          <ShieldCheck className="w-3 h-3" aria-hidden /> Verified
        </Badge>
      );
    case "marketplace-ready":
      return (
        <Badge variant="default" className="gap-1">
          <Store className="w-3 h-3" aria-hidden /> Marketplace-ready
        </Badge>
      );
  }
}
