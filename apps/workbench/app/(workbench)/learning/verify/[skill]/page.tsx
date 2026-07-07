// SPDX-License-Identifier: Apache-2.0
// Workbench , Verification detail page for a single skill
"use client";
import * as React from "react";
import { VerificationStatusBadge } from "../../../../../components/verification-status-badge";
export default function VerifySkillPage({ params }: { params: { skill: string } }) {
  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Verification: {params.skill}</h1>
      <VerificationStatusBadge status="unverified" />
      <p className="text-muted-foreground mt-4">
        Verification history and details wire at runtime.
      </p>
    </div>
  );
}
