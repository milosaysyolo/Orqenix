// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// SUBAGENT FORM — create/edit subagent modal with tabbed identity, harness,
// and raw config editors. Receives form state + setField from parent hook.
// ============================================================================

'use client';

import * as React from 'react';
import { Button } from '@/components/ui';
import { ConfigEditor } from '@/components/config-editor';
import { Modal } from '@/components/modal';
import { TabbedForm } from '@/components/tabbed-form';
import type { SubagentFormState } from '@/lib/use-subagent-form';

interface SubagentFormProps {
  open: boolean;
  editSubagent: { id: string; name: string } | null;
  busyCrud: boolean;
  form: SubagentFormState;
  setField: <K extends keyof SubagentFormState>(
    key: K,
    value: SubagentFormState[K],
  ) => void;
  onClose: () => void;
  onSave: () => void;
}

export function SubagentForm({
  open,
  editSubagent,
  busyCrud,
  form,
  setField,
  onClose,
  onSave,
}: SubagentFormProps) {
  if (!open) return null;

  return (
    <Modal
      title={editSubagent ? 'Edit Subagent' : 'New Subagent'}
      onClose={onClose}
      wide
    >
      <TabbedForm
        tabs={[
          {
            key: 'identity',
            label: 'Identity',
            content: (
              <div className="space-y-3">
                <div>
                  <label className="font-mono text-[10px] text-[var(--faint)]">
                    Name *
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-mono text-[10px] text-[var(--faint)]">
                      Role
                    </label>
                    <input
                      value={form.role}
                      onChange={(e) => setField('role', e.target.value)}
                      placeholder="e.g. code generation"
                      className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-[var(--faint)]">
                      Kind
                    </label>
                    <input
                      value={form.kind}
                      onChange={(e) => setField('kind', e.target.value)}
                      placeholder="e.g. coder"
                      className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
                    />
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: 'harness',
            label: 'Harness',
            content: (
              <div className="space-y-3">
                <div>
                  <label className="font-mono text-[10px] text-[var(--faint)]">
                    System Prompt
                  </label>
                  <textarea
                    value={form.systemPrompt}
                    onChange={(e) => setField('systemPrompt', e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[10px] text-[var(--ink)] outline-none focus:border-[var(--rust)] resize-none"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-[var(--faint)]">
                    Goal
                  </label>
                  <textarea
                    value={form.goal}
                    onChange={(e) => setField('goal', e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[10px] text-[var(--ink)] outline-none focus:border-[var(--rust)] resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-mono text-[10px] text-[var(--faint)]">
                      Max Steps
                    </label>
                    <input
                      type="number"
                      value={form.maxSteps}
                      onChange={(e) => setField('maxSteps', e.target.value)}
                      className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-[var(--faint)]">
                      Max Wall Time (s)
                    </label>
                    <input
                      type="number"
                      value={form.maxTime}
                      onChange={(e) => setField('maxTime', e.target.value)}
                      className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-mono text-[10px] text-[var(--faint)]">
                    Allowed Tools
                  </label>
                  <input
                    value={form.allowedTools}
                    onChange={(e) => setField('allowedTools', e.target.value)}
                    placeholder="read_memory,search_code"
                    className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-[var(--faint)]">
                    Forbidden Tools
                  </label>
                  <input
                    value={form.forbiddenTools}
                    onChange={(e) => setField('forbiddenTools', e.target.value)}
                    placeholder="write_file,git_commit"
                    className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
                  />
                </div>
              </div>
            ),
          },
          {
            key: 'config',
            label: 'Config',
            content: (
              <div>
                <div className="font-mono text-[9.5px] text-[var(--faint)] mb-1">
                  Edit raw markdown config directly
                </div>
                <ConfigEditor
                  value={form.configRaw}
                  onChange={(v) => setField('configRaw', v)}
                  language="markdown"
                  height={250}
                />
              </div>
            ),
          },
        ]}
        footer={
          <div className="flex gap-2 pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void onSave()}
              disabled={busyCrud}
            >
              {busyCrud
                ? '\u2026'
                : editSubagent
                  ? 'Save Changes'
                  : 'Create Subagent'}
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        }
      />
    </Modal>
  );
}
