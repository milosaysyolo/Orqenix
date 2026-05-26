/**
 * Team manifest: bundle of Lead + Sub-agents + defaults.
 * See CHAPTER 7 of the spec.
 */

export type AgentDeclaration = {
  role: string;
  file: string;
  mode: "primary" | "subagent" | "all";
  isTeamLead?: boolean;
  lazyTriggers?: string[];
};

export interface TeamManifest {
  $schema?: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;

  namingPrefix: string;

  teamLead: AgentDeclaration;

  agents: {
    core: AgentDeclaration[];
    optional: AgentDeclaration[];
  };

  defaultSkills: string[];
  defaultMCP: string[];

  syncTargets: {
    opencode?: {
      enabled: boolean;
      outputDir: string;
      filenamePattern: string;
    };
    claude?: {
      enabled: boolean;
      outputDir: string;
      filenamePattern?: string;
    };
  };
}
