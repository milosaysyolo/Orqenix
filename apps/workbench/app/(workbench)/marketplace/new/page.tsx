// SPDX-License-Identifier: Apache-2.0

"use client";

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SectionTitle, Card, Button } from '@/components/ui';
import { useToast } from '@/components/toast';

const ALL_KINDS = [
  { id: 'knowledge-source', label: 'Knowledge Source' },
  { id: 'embedding-model', label: 'Embedding Model' },
  { id: 'reranker', label: 'Reranker' },
  { id: 'compression-strategy', label: 'Compression Strategy' },
  { id: 'memory-injection-strategy', label: 'Injection Strategy' },
  { id: 'prompt-rewriter', label: 'Prompt Rewriter' },
  { id: 'visualization', label: 'Visualization' },
  { id: 'code-analyzer', label: 'Code Analyzer' },
  { id: 'kb-schema', label: 'KB Schema' },
  { id: 'mcp-server', label: 'MCP Server' },
  { id: 'agent', label: 'Agent' },
  { id: 'subagent', label: 'Subagent' },
  { id: 'skill', label: 'Skill' },
  { id: 'agent-binding', label: 'Agent Binding' },
];

function NewPluginForm() {
  const searchParams = useSearchParams();
  const fromCandidate = searchParams.get('fromCandidate');
  const { toast } = useToast();
  const [name, setName] = React.useState(fromCandidate ?? '');
  const [kind, setKind] = React.useState('skill');
  const [description, setDescription] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  async function handleCreate() {
    if (!name.trim() || !description.trim()) return;
    setCreating(true);
    await new Promise((r) => setTimeout(r, 800));
    setCreating(false);
    toast({ title: 'Plugin created', message: `${name} (${kind}) has been created`, tone: 'success' });
  }

  return (
    <div className="mx-auto max-w-[800px] px-6 py-6">
      <div className="flex items-center gap-3">
        <Link href="/marketplace" className="font-mono text-[12px] text-[var(--dim)] hover:text-[var(--ink)]">{'\u2190'} Marketplace</Link>
      </div>
      <SectionTitle sub={fromCandidate ? `From candidate: ${fromCandidate}` : 'Define a new local plugin'}>
        {fromCandidate ? 'Create Plugin from Candidate' : 'New Plugin'}
      </SectionTitle>

      {fromCandidate && (
        <Card className="mt-3 p-3 border-[color-mix(in_oklab,var(--amber)35%,transparent)] bg-[color-mix(in_oklab,var(--amber)4%,var(--card))]">
          <div className="font-mono text-[10.5px] text-[var(--dim)]">
            {'\uD83D\uDEE1'} This plugin is being created from a promoted learning candidate. The CSF structure will be auto-generated.
          </div>
        </Card>
      )}

      <Card className="mt-4 p-5">
        <div className="space-y-4">
          <div>
            <label className="block font-mono text-[10px] text-[var(--faint)]">Plugin Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="my-awesome-plugin"
              className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" />
          </div>

          <div>
            <label className="block font-mono text-[10px] text-[var(--faint)]">Kind</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)}
              className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)]">
              {ALL_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block font-mono text-[10px] text-[var(--faint)]">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this plugin do?"
              rows={3}
              className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="primary" size="sm" onClick={handleCreate} disabled={!name.trim() || !description.trim() || creating}>
              {creating ? 'Creating\u2026' : 'Create Plugin'}
            </Button>
            <Link href="/marketplace">
              <Button variant="ghost" size="sm">Cancel</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function NewPluginPage() {
  return (
    <React.Suspense fallback={
      <div className="mx-auto max-w-[800px] px-6 py-6 font-mono text-[11px] text-[var(--faint)]">Loading&hellip;</div>
    }>
      <NewPluginForm />
    </React.Suspense>
  );
}
