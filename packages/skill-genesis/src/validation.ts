// SPDX-License-Identifier: Apache-2.0
export function validateSkillName(name: string): boolean {
  return /^[a-z][a-z0-9_-]*$/.test(name) && name.length >= 2 && name.length <= 64;
}
