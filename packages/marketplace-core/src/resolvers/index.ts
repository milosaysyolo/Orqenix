// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-core , Default resolver factory
//
// Builds the standard set of 6 resolvers. Operators customize via options.

import { RegistryResolverRegistry } from "../registry-resolver";
import { OrqenixOfficialResolver, type OrqenixOfficialOptions } from "./orqenix-official";
import { NpmRegistryResolver, type NpmResolverOptions } from "./npm";
import { GithubResolver, type GithubResolverOptions } from "./github";
import { LocalFileResolver, type LocalFileResolverOptions } from "./local-file";
import { PrivateGitResolver, type PrivateGitResolverOptions } from "./private-git";
import { EnterpriseResolver, type EnterpriseResolverOptions } from "./enterprise";

export {
  OrqenixOfficialResolver,
  NpmRegistryResolver,
  GithubResolver,
  LocalFileResolver,
  PrivateGitResolver,
  EnterpriseResolver,
};

export interface DefaultResolversConfig {
  orqenixOfficial?: OrqenixOfficialOptions;
  npm?: NpmResolverOptions;
  github?: GithubResolverOptions;
  localFile?: LocalFileResolverOptions;
  privateGit?: PrivateGitResolverOptions;
  enterprise?: EnterpriseResolverOptions;
}

/**
 * Builds a RegistryResolverRegistry with the 6 default resolvers.
 * Per Anti-pattern 39: resolvers are constructed here, never hardcoded in core.
 */
export function buildDefaultResolvers(
  config: DefaultResolversConfig = {},
): RegistryResolverRegistry {
  return new RegistryResolverRegistry([
    new OrqenixOfficialResolver(config.orqenixOfficial),
    new NpmRegistryResolver(config.npm),
    new GithubResolver(config.github),
    new LocalFileResolver(config.localFile),
    new PrivateGitResolver(config.privateGit),
    new EnterpriseResolver(config.enterprise),
  ]);
}
