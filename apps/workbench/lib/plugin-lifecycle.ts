// SPDX-License-Identifier: Apache-2.0

export interface PluginLifecycle {
  name: string;
  version: string;
  enabled: boolean;
}

export function getPluginLifecycle(): PluginLifecycle[] {
  return [];
}
