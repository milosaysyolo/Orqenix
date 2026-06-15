// SPDX-License-Identifier: Apache-2.0
// @orqenix/verification-loop , skill.verified audit kind
export const VERIFICATION_AUDIT_KIND = 'skill.verified';
export interface VerificationAuditPayload {
  skillName: string;
  newStatus: string;
  passed: boolean;
}
