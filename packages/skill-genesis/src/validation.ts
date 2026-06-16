// SPDX-License-Identifier: Apache-2.0
// @orqenix/skill-genesis , Validation
// File 75/155 — D8.y.1.4
// Validate generated CSF passes conformance checks.

export function validateSkillName(name: string): boolean {
  return /^[a-z][a-z0-9_-]*$/i.test(name);
}
