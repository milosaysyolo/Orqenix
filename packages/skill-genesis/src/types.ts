// SPDX-License-Identifier: Apache-2.0
// @orqenix/skill-genesis , Type definitions

import type { ImplementationLanguage } from '@orqenix/plugin-core';
import type { CanonicalSkillFormat } from '@orqenix/plugin-core';
import type { Database } from 'better-sqlite3';

/** Input to generate a skill from a candidate */
export interface GenerateFromCandidateInput {
  candidateId: string;
  projectId: string;
  /** Optional language override (default: inferred) */
  language?: ImplementationLanguage;
  /** Optional name override (default: candidate's suggested name) */
  nameOverride?: string;
}

/** Result of skill generation */
export interface GenerateResult {
  skillName: string;
  csfHash: string;
  /** Inferred input schema */
  inputSchema: Record<string, unknown>;
  /** Synthesized code */
  code: string;
  language: ImplementationLanguage;
  /** Number of test fixtures generated */
  fixtureCount: number;
  /** Observation event IDs this skill was derived from */
  derivedFromObservations: string[];
}

/** An inferred parameter from observation variations */
export interface InferredParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** Whether the parameter varied across observations (vs constant) */
  variable: boolean;
  /** Sample values observed */
  samples: unknown[];
  required: boolean;
}

/** A generated test fixture */
export interface GeneratedFixture {
  name: string;
  input: Record<string, unknown>;
  expectedOutcome: 'success' | 'error';
}

export interface SkillGenesisOptions {
  /** Database instance */
  db: Database;
  /** Project identifier */
  projectId: string;
  /** Confidence threshold (0-1) for auto-generation */
  confidenceThreshold?: number;
}

export interface GeneratedSkill {
  name: string;
  csf: CanonicalSkillFormat;
  observations: string[];
}
