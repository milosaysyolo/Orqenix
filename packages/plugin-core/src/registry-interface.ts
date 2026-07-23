// SPDX-License-Identifier: Apache-2.0
// Shared PluginRegistry interface.
// Implemented by both @orqenix/core's PluginHookRegistry and
// @orqenix/plugin-core's PluginRegistry to document their shared
// contract: register, unregister, list, has, get.
//
// Uses `any` types since concrete parameter types differ between
// the hooks-based registry (OrqenixPlugin) and the lifecycle-based
// registry (PluginDiscoveryResult).

export interface PluginRegistry {
  register(plugin: any): Promise<void>;
  unregister(name: string): Promise<void>;
  list(): any[];
  has(name: string): boolean;
  get(name: string): any | undefined;
}
