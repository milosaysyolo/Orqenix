// SPDX-License-Identifier: Apache-2.0
// @orqenix/skill-genesis , Skill Genesis (top-level)
//
// Synthesizes a full CSF skill from a promoted candidate. Per CR v8.0
// Section 9.4.4 + Anti-38 (created unverified).

import type { Database } from 'better-sqlite3';
import { buildCsf } from '@orqenix/normalization-engine';
import { Observer, DEFAULT_GOVERNANCE } from '@orqenix/self-learning-observer';
import type { SelfLearningGovernance } from '@orqenix/self-learning-observer';
import { CandidateStore } from '@orqenix/self-learning-detection';
import type { CanonicalSkillFormat } from '@orqenix/plugin-core';
import type { ObservationEvent } from '@orqenix/self-learning-observer';
import { ParameterInference } from './parameter-inference';
import { CodeSynthesizer } from './code-synthesizer';
import { FixtureGenerator } from './fixture-generator';
import type { GenerateFromCandidateInput, GenerateResult } from './types';

export interface SkillGenesisOptions {
  db: Database;
  observer?: Observer;
  candidateStore?: CandidateStore;
  /** Optional governance to cap skills generated per cycle */
  governance?: Partial<SelfLearningGovernance>;
}

export class SkillGenesis {
  private readonly db: Database;
  private readonly observer: Observer;
  private readonly candidateStore: CandidateStore;
  private readonly paramInference = new ParameterInference();
  private readonly codeSynth = new CodeSynthesizer();
  private readonly fixtureGen = new FixtureGenerator();
  private readonly generationCap: number;
  generationCount = 0;

  constructor(options: SkillGenesisOptions) {
    this.db = options.db;
    this.observer = options.observer ?? new Observer({ db: this.db });
    this.candidateStore = options.candidateStore ?? new CandidateStore(this.db);
    this.generationCap = options.governance?.generationCap ?? DEFAULT_GOVERNANCE.generationCap;
  }

  /**
   * Generates a CSF skill from a promoted candidate.
   *
   * Steps (CR v8.0 Section 9.4.4):
   *   1. Load candidate + its observation samples
   *   2. Infer parameters from variations
   *   3. Synthesize code (language inferred)
   *   4. Generate test fixtures
   *   5. Build CSF with derived_from_observations + verification_status=unverified
   */
  async generateFromCandidate(input: GenerateFromCandidateInput): Promise<GenerateResult> {
    if (this.generationCount >= this.generationCap) {
      throw new Error(
        `Generation cap of ${this.generationCap} reached; cannot generate more skills this cycle`
      );
    }

    const candidate = this.candidateStore.get(input.candidateId);
    if (!candidate) {
      throw new Error(`Candidate ${input.candidateId} not found`);
    }

    // Load observation samples
    const sampleIds = JSON.parse(candidate.sample_observation_ids) as string[];
    const allEvents = this.observer.query({ projectId: input.projectId, limit: 2000 });
    const byId = new Map(allEvents.map((e) => [e.id, e]));
    const sampleEvents = sampleIds
      .map((id) => byId.get(id))
      .filter((e): e is NonNullable<typeof e> => e !== undefined);

    // 2. Infer parameters
    const parameters = this.paramInference.infer(sampleEvents);
    const inputSchema = this.paramInference.toInputSchema(parameters);

    // 3. Synthesize code
    const language = input.language ?? this.codeSynth.inferLanguage(sampleEvents);
    const actionKinds = this.extractActionKinds(candidate.pattern_name ?? "", sampleEvents);
    const skillName = input.nameOverride ?? candidate.pattern_name ?? "@local/generated-skill";
    const code = this.codeSynth.synthesize({
      skillName,
      actionKinds,
      parameters,
      sampleEvents,
      language,
    });

    // 4. Generate fixtures
    const fixtures = this.fixtureGen.generate(sampleEvents, parameters);

    // 5. Build CSF (Anti-38: unverified)
    const toolName = skillName.split("/").pop()!.replace(/-/g, "_");
    const csf: CanonicalSkillFormat = buildCsf({
      name: skillName,
      version: "0.1.0",
      kind: "skill",
      tool: {
        name: toolName,
        description: candidate.pattern_description ?? "Generated from observed workflow",
        inputSchema,
        outputSchema: {
          type: "object",
          properties: { success: { type: "boolean" }, result: {} },
          required: ["success"],
        },
      },
      permissions: this.inferPermissions(sampleEvents),
      external_agent_compat: ["claude-code", "cursor", "codex", "opencode"],
      language,
      entry:
        language === "python" ? "./skill.py" : language === "shell" ? "./skill.sh" : "./skill.ts",
      source: code,
      examples: fixtures.map((f) => ({
        name: f.name,
        input: f.input,
        expectedOutput: { success: f.expectedOutcome === "success" },
      })),
      importedFromKind: "self-learning",
      normalizerVersion: "0.8.0-alpha.1",
      originalFormatPreserved: { generatedFromCandidate: candidate.id },
    });

    // Tag derived_from_observations provenance
    csf.provenance.derived_from_observations = sampleIds;
    csf.provenance.verification_status = "unverified"; // Anti-38

    // Persist into local_plugins (marketplace store) if available
    this.persistGenerated(csf);

    this.generationCount++;

    return {
      skillName,
      csfHash: csf.provenance.contentHash,
      inputSchema,
      code,
      language,
      fixtureCount: fixtures.length,
      derivedFromObservations: sampleIds,
    };
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private extractActionKinds(_patternName: string, events: ObservationEvent[]): string[] {
    // Reconstruct ordered distinct action kinds from samples
    const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const kinds: string[] = [];
    for (const e of sorted) {
      if (kinds[kinds.length - 1] !== e.action_kind) kinds.push(e.action_kind);
    }
    return kinds.length > 0 ? kinds : ["tool_call"];
  }

  private inferPermissions(events: ObservationEvent[]): string[] {
    const perms = new Set<string>();
    for (const e of events) {
      switch (e.action_kind) {
        case "shell_command":
          perms.add("command.execute:limited");
          break;
        case "git_operation":
          perms.add("git.write");
          break;
        case "file_edit":
          perms.add("fs.write");
          break;
        case "file_read":
          perms.add("fs.read");
          break;
        case "memory_write":
        case "decision_recorded":
        case "lesson_recorded":
          perms.add("memory.write:decision");
          break;
        default:
          perms.add("scope.read");
      }
    }
    return Array.from(perms);
  }

  private persistGenerated(csf: CanonicalSkillFormat): void {
    // Best-effort persist to local_plugins (table exists if D8.β migration ran)
    try {
      this.db
        .prepare(
          `INSERT INTO local_plugins (name, csf_json, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(name) DO UPDATE SET csf_json = excluded.csf_json, updated_at = excluded.updated_at`,
        )
        .run(csf.name, JSON.stringify(csf), new Date().toISOString());
    } catch {
      // local_plugins table may not exist in standalone test; ignore
    }
  }
}
