// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-ui , ImportExportWizard

'use client';

import * as React from 'react';
import { Upload, Download, AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Button, Input, Label, Badge,
} from '@orqenix/ui-primitives';

const INPUT_SOURCES = [
  'auto-detect', 'claude-code', 'cursor', 'codex', 'opencode', 'mcp',
  'continue', 'aider', 'cline', 'npm', 'github', 'url', 'private-git', 'user-custom',
];

const OUTPUT_TARGETS = [
  'claude-code', 'cursor', 'codex', 'opencode', 'mcp', 'continue', 'aider', 'npm',
];

export interface ImportExportWizardProps {
  mode: 'import' | 'export';
  open: boolean;
  /** For export: the plugin being exported */
  pluginName?: string;
  onClose: () => void;
  onImport?: (input: { sourceKind?: string; url?: string; content?: string }) => Promise<{ ok: boolean; warnings: string[] }>;
  onExport?: (input: { targetKind: string; acceptLossy: boolean }) => Promise<{ ok: boolean; lossyFields: string[] }>;
}

export function ImportExportWizard(props: ImportExportWizardProps): React.ReactElement {
  const [sourceKind, setSourceKind] = React.useState('auto-detect');
  const [targetKind, setTargetKind] = React.useState('npm');
  const [url, setUrl] = React.useState('');
  const [content, setContent] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [lossyFields, setLossyFields] = React.useState<string[]>([]);
  const [warnings, setWarnings] = React.useState<string[]>([]);

  async function handleImport(): Promise<void> {
    if (!props.onImport) return;
    setBusy(true);
    try {
      const result = await props.onImport({
        ...(sourceKind !== 'auto-detect' ? { sourceKind } : {}),
        ...(url ? { url } : {}),
        ...(content ? { content } : {}),
      });
      setWarnings(result.warnings);
      if (result.ok) props.onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(acceptLossy: boolean): Promise<void> {
    if (!props.onExport) return;
    setBusy(true);
    try {
      const result = await props.onExport({ targetKind, acceptLossy });
      if (!result.ok && result.lossyFields.length > 0) {
        setLossyFields(result.lossyFields); // show lossy warning, await re-confirm
      } else if (result.ok) {
        props.onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={(o: boolean) => !o && props.onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {props.mode === 'import' ? <Upload className="w-5 h-5" aria-hidden /> : <Download className="w-5 h-5" aria-hidden />}
            {props.mode === 'import' ? 'Import Plugin' : `Export ${props.pluginName}`}
          </DialogTitle>
          <DialogDescription>
            {props.mode === 'import'
              ? 'Import a plugin from an external format. It will be normalized to CSF.'
              : 'Export this plugin to a target platform format.'}
          </DialogDescription>
        </DialogHeader>

        {props.mode === 'import' ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Source format</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={sourceKind}
                onChange={(e) => setSourceKind(e.target.value)}
              >
                {INPUT_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-url">URL (npm/github/direct)</Label>
              <Input id="import-url" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-content">Or paste content</Label>
              <textarea
                id="import-content"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono min-h-24"
                placeholder="Paste plugin definition..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
            {warnings.length > 0 && (
              <div className="rounded-md border border-orqenix-amber/30 bg-orqenix-amber/5 p-3 text-xs">
                {warnings.map((w, i) => <div key={i}>{w}</div>)}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Target format</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                value={targetKind}
                onChange={(e) => { setTargetKind(e.target.value); setLossyFields([]); }}
              >
                {OUTPUT_TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {lossyFields.length > 0 && (
              <div className="rounded-md border border-status-warning/30 bg-status-warning/5 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium mb-1">
                  <AlertTriangle className="w-4 h-4 text-status-warning" aria-hidden /> Lossy export
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  These fields cannot be represented in {targetKind} and will be lost:
                </p>
                <div className="flex flex-wrap gap-1">
                  {lossyFields.map((f) => <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>)}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={props.onClose} disabled={busy}>Cancel</Button>
          {props.mode === 'import' ? (
            <Button onClick={() => void handleImport()} disabled={busy}>
              {busy ? 'Importing...' : 'Import'}
            </Button>
          ) : lossyFields.length > 0 ? (
            <Button variant="destructive" onClick={() => void handleExport(true)} disabled={busy}>
              Proceed with lossy export
            </Button>
          ) : (
            <Button onClick={() => void handleExport(false)} disabled={busy}>
              {busy ? 'Exporting...' : 'Export'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
