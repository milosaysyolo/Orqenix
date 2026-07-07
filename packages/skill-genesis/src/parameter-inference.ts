// SPDX-License-Identifier: Apache-2.0
// @orqenix/skill-genesis , Parameter inference
//
// Analyzes observation samples to extract parameters: which fields varied
// (→ inputs) vs constant (→ baked into code). Per CR v8.0 Section 9.4.4.

import type { ObservationEvent } from "@orqenix/self-learning-observer";
import type { InferredParameter } from "./types";

export class ParameterInference {
  /**
   * Infers parameters from observation samples by comparing action payloads.
   * Fields that vary across observations become input parameters; fields that
   * are constant are baked into the synthesized code.
   */
  infer(events: ObservationEvent[]): InferredParameter[] {
    if (events.length === 0) return [];

    // Collect all field paths + values across observations
    const fieldValues = new Map<string, Set<string>>();
    const fieldSamples = new Map<string, unknown[]>();

    for (const e of events) {
      const flat = this.flatten(e.action_payload);
      for (const [key, value] of Object.entries(flat)) {
        const valSet = fieldValues.get(key) ?? new Set();
        valSet.add(JSON.stringify(value));
        fieldValues.set(key, valSet);

        const samples = fieldSamples.get(key) ?? [];
        if (samples.length < 5) samples.push(value);
        fieldSamples.set(key, samples);
      }
    }

    const params: InferredParameter[] = [];
    for (const [key, valSet] of fieldValues) {
      const variable = valSet.size > 1; // varied across observations
      const samples = fieldSamples.get(key) ?? [];
      params.push({
        name: this.toParamName(key),
        type: this.inferType(samples),
        variable,
        samples: samples.slice(0, 3),
        // Variable fields become required inputs; constants are optional
        required: variable,
      });
    }

    // Only variable fields are interesting as parameters
    return params.filter((p) => p.variable);
  }

  /** Builds a JSON Schema from inferred parameters */
  toInputSchema(params: InferredParameter[]): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const p of params) {
      properties[p.name] = {
        type: p.type,
        ...(p.samples.length > 0 ? { examples: p.samples } : {}),
      };
      if (p.required) required.push(p.name);
    }
    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private flatten(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(out, this.flatten(value as Record<string, unknown>, path));
      } else {
        out[path] = value;
      }
    }
    return out;
  }

  private inferType(samples: unknown[]): InferredParameter["type"] {
    if (samples.length === 0) return "string";
    const first = samples[0];
    if (typeof first === "number") return "number";
    if (typeof first === "boolean") return "boolean";
    if (Array.isArray(first)) return "array";
    if (first !== null && typeof first === "object") return "object";
    return "string";
  }

  private toParamName(fieldPath: string): string {
    // dot.path → camelCase-ish param name
    return fieldPath
      .split(".")
      .pop()!
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/^_+|_+$/g, "");
  }
}
