// SPDX-License-Identifier: Apache-2.0
// Type declarations for Orqenix Pro packages (dynamically imported, graceful degradation)

declare module '@orqenix-pro/cross-project-federation' {
  export interface FederationCandidate {
    projectId: string;
    projectName: string;
    similarity: number;
  }

  export function queryCandidates(input: {
    query: string;
    projectId: string;
  }): Promise<FederationCandidate[]>;
}
