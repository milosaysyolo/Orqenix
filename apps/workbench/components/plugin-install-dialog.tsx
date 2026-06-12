// SPDX-License-Identifier: Apache-2.0
// Plugin install dialog , reviews manifest + permissions before installing

'use client';

import * as React from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Badge,
} from '@orqenix/ui-primitives';

interface PluginManifestPreview {
  name: string;
  version: string;
  kind: string;
  license: string;
  permissions: string[];
  external_agent_compat: string[];
  isVerified: boolean;
  sandboxMode: string;
  warnings: string[];
}

export interface PluginInstallDialogProps {
  open: boolean;
  manifest: PluginManifestPreview | null;
  onClose: () => void;
  onConfirm: (name: string) => Promise<void>;
}

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  'scope.read': 'Read project scope identity',
  'scope.write': 'Modify project scope',
  'git.read': 'Read git state',
  'git.write': 'Modify git state (commits, branches)',
  'network.fetch': 'Make outbound network requests',
  'command.execute:limited': 'Run commands from an allowlist',
  'command.execute:full': 'Run arbitrary commands',
};

export function PluginInstallDialog({
  open,
  manifest,
  onClose,
  onConfirm,
}: PluginInstallDialogProps) {
  const [installing, setInstalling] = React.useState(false);

  if (!manifest) return null;

  const hasDangerousPerms = manifest.permissions.some(
    (p) => p === 'command.execute:full' || p === 'scope.write'
  );

  async function handleConfirm() {
    if (!manifest) return;
    setInstalling(true);
    try {
      await onConfirm(manifest.name);
      onClose();
    } finally {
      setInstalling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Install {manifest.name}
            <Badge variant="secondary" className="text-xs">
              v{manifest.version}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Review permissions and verification status before installing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {manifest.isVerified ? (
            <div className="flex items-center gap-2 rounded-md border border-status-success/30 bg-status-success/5 p-3 text-sm">
              <ShieldCheck className="w-5 h-5 text-status-success shrink-0" aria-hidden />
              <span>Signed and verified via Sigstore</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-orqenix-amber/30 bg-orqenix-amber/5 p-3 text-sm">
              <ShieldAlert className="w-5 h-5 text-orqenix-amber shrink-0 mt-0.5" aria-hidden />
              <div>
                <div className="font-medium">Unverified plugin</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  This plugin is not Sigstore-signed. Install only if you trust the source.
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Kind:</span>{' '}
              <span className="font-medium">{manifest.kind}</span>
            </div>
            <div>
              <span className="text-muted-foreground">License:</span>{' '}
              <span className="font-medium">{manifest.license}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Sandbox:</span>{' '}
              <span className="font-medium">{manifest.sandboxMode}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Compatible:</span>{' '}
              <span className="font-medium text-xs">
                {manifest.external_agent_compat.join(', ') || 'none'}
              </span>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">
              Requested permissions ({manifest.permissions.length})
            </div>
            <div className="space-y-1">
              {manifest.permissions.map((perm) => {
                const dangerous = perm === 'command.execute:full' || perm === 'scope.write';
                return (
                  <div
                    key={perm}
                    className="flex items-center gap-2 text-xs py-1"
                  >
                    {dangerous ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-status-warning shrink-0" aria-hidden />
                    ) : (
                      <span className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <code className="font-mono">{perm}</code>
                    <span className="text-muted-foreground">
                      {PERMISSION_DESCRIPTIONS[perm] ?? ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {manifest.warnings.length > 0 && (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="text-xs font-medium mb-1">Advisories</div>
              <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                {manifest.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {hasDangerousPerms && (
            <div className="rounded-md border border-status-warning/30 bg-status-warning/5 p-3 text-xs">
              <AlertTriangle className="w-4 h-4 text-status-warning inline mr-1" aria-hidden />
              This plugin requests elevated permissions. Verify the source is trustworthy.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={installing}>
            Cancel
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={installing}>
            {installing ? 'Installing...' : 'Install'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
