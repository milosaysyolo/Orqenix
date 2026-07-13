// SPDX-License-Identifier: Apache-2.0

'use client';

import * as React from 'react';
import Link from 'next/link';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { useToast } from '@/components/toast';

const INPUT_ADAPTERS = [
  { id: 'auto-detect', label: 'Auto-detect', desc: 'Let Orqenix guess the source format' },
  { id: 'claude-code', label: 'Claude Code', desc: 'Import from Claude Code project' },
  { id: 'cursor', label: 'Cursor', desc: 'Import from Cursor rules' },
  { id: 'codex', label: 'Codex', desc: 'Import from ChatGPT Codex' },
  { id: 'opencode', label: 'OpenCode', desc: 'Import from OpenCode' },
  { id: 'mcp', label: 'MCP Server', desc: 'Import MCP server tools and resources' },
  { id: 'continue', label: 'Continue', desc: 'Import from Continue.dev config' },
  { id: 'aider', label: 'Aider', desc: 'Import from Aider conventions' },
  { id: 'cline', label: 'Cline', desc: 'Import from Cline custom modes' },
  { id: 'npm', label: 'npm', desc: 'Import from an npm package' },
  { id: 'github', label: 'GitHub', desc: 'Clone from a GitHub repository' },
  { id: 'url', label: 'URL', desc: 'Fetch from any URL' },
  { id: 'local-file', label: 'Local File', desc: 'Read from local file system' },
  { id: 'user-custom', label: 'Custom', desc: 'Paste raw CSF / YAML / JSON' },
];

export default function ImportPage() {
  const { toast } = useToast();
  const [selectedAdapter, setSelectedAdapter] = React.useState<string | null>(null);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-6">
      <div className="flex items-center gap-3">
        <Link href="/marketplace" className="font-mono text-[12px] text-[var(--dim)] hover:text-[var(--ink)]">{'\u2190'} Marketplace</Link>
      </div>
      <SectionTitle sub="Normalize from 14 source formats into the Canonical Skill Format (CSF)">Import Plugin</SectionTitle>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INPUT_ADAPTERS.map((adapter) => (
          <Card key={adapter.id}
            className={'cursor-pointer p-4 transition-colors hover:border-[var(--rust)] ' + (selectedAdapter === adapter.id ? 'border-[var(--rust)]' : '')}
            onClick={() => setSelectedAdapter(adapter.id)}>
            <div className="font-mono text-[12px] font-bold text-[var(--ink)]">{adapter.label}</div>
            <p className="mt-1 text-[11px] text-[var(--dim)]">{adapter.desc}</p>
          </Card>
        ))}
      </div>

      {selectedAdapter && (
        <Card className="mt-4 p-4 border-[var(--rust)]">
          <div className="font-mono text-[11px] text-[var(--ink)]">Selected: {INPUT_ADAPTERS.find((a) => a.id === selectedAdapter)?.label}</div>
          <p className="mt-1 text-[11px] text-[var(--dim)]">
            Paste or upload the source file below. The normalizer will convert it to Canonical Skill Format (CSF).
          </p>
          <textarea
            className="mt-3 w-full rounded-[7px] border border-[var(--line)] bg-[var(--card)] p-3 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
            rows={8}
            placeholder={`Paste ${INPUT_ADAPTERS.find((a) => a.id === selectedAdapter)?.label} content here\u2026`}
          />
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" onClick={() => toast({ title: 'Import started', message: 'CSF conversion in progress', tone: 'success' })}>
              Import & Convert
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedAdapter(null)}>Cancel</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
