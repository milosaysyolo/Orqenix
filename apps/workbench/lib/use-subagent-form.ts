// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// USE SUBAGENT FORM — consolidated form state for subagent create/edit.
// Replaces ~10 individual useState calls with a single structured state.
// ============================================================================

'use client';

import * as React from 'react';

export interface SubagentFormState {
  name: string;
  role: string;
  kind: string;
  systemPrompt: string;
  goal: string;
  maxSteps: string;
  maxTime: string;
  allowedTools: string;
  forbiddenTools: string;
  configRaw: string;
}

const DEFAULT_STATE: SubagentFormState = {
  name: '',
  role: '',
  kind: '',
  systemPrompt: '',
  goal: '',
  maxSteps: '5',
  maxTime: '90',
  allowedTools: '',
  forbiddenTools: 'write_file,git_commit',
  configRaw: '',
};

export function useSubagentForm() {
  const [form, setForm] = React.useState<SubagentFormState>(DEFAULT_STATE);

  const setField = React.useCallback(
    <K extends keyof SubagentFormState>(key: K, value: SubagentFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const reset = React.useCallback(
    (overrides?: Partial<SubagentFormState>) => {
      setForm({ ...DEFAULT_STATE, ...overrides });
    },
    [],
  );

  return { form, setField, reset };
}
