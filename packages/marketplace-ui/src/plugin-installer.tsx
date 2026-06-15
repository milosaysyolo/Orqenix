// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-ui , PluginInstaller dialog with permission review

'use client';

import * as React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, Button, Badge,
} from '@orqenix/ui-primitives';

export interface PluginInstallerProps {
  open: boolean;
  plugin: {
    name: string;
    version: string;
    kind: string;
    license: string;
    permissions: string[];
    verified: boolean;
    sandboxMode: string;
  } | null;
  onClose: () => void;
  onConfirm: (name: string) => Promise<void>;
}

const DANGEROUS = new Set(['command.execute:full', 'scope.write']);

export function PluginInstaller({ open, plugin, onClose, onConfirm }: PluginInstallerProps): React.ReactElement | null {
  const [installing, setInstalling] = React.useState(false);
  if (!plugin) return null;

  const hasDangerous = plugin.permissions.some((p) => DANGEROUS.has(p));

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Install {plugin.name}
            <Badge variant="secondary" className="text-xs">v{plugin.version}</Badge>
          </DialogTitle>
          <DialogDescription>Review permissions before installing.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {plugin.verified ? (
            <div className="flex items-center gap-2 rounded-md border border-status-success/30 bg-status-success/5 p-3 text-sm">
              <ShieldCheck className="w-5 h-5 text-status-success shrink-0" aria-hidden />
              Signed and verified via Sigstore
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-orqenix-amber/30 bg-orqenix-amber/5 p-3 text-sm">
              <ShieldAlert className="w-5 h-5 text-orqenix-amber shrink-0 mt-0.5" aria-hidden />
              <div>
                <div className="font-medium">Unverified plugin</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Not Sigstore-signed. Install only if you trust the source.
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Kind:</span> {plugin.kind}</div>
            <div><span className="text-muted-foreground">License:</span> {plugin.license}</div>
            <div><span className="text-muted-foreground">Sandbox:</span> {plugin.sandboxMode}</div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Requested permissions ({plugin.permissions.length})</div>
            <div className="space-y-1">
              {plugin.permissions.map((perm) => (
                <div key={perm} className="flex items-center gap-2 text-xs py-1">
                  {DANGEROUS.has(perm) && <AlertTriangle className="w-3.5 h-3.5 text-status-warning shrink-0" aria-hidden />}
                  <code className="font-mono">{perm}</code>
                </div>
              ))}
            </div>
          </div>

          {hasDangerous && (
            <div className="rounded-md border border-status-warning/30 bg-status-warning/5 p-3 text-xs">
              <AlertTriangle className="w-4 h-4 text-status-warning inline mr-1" aria-hidden />
              This plugin requests elevated permissions. Verify the source is trustworthy.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={installing}>Cancel</Button>
          <Button
            onClick={async () => {
              setInstalling(true);
              try { await onConfirm(plugin.name); onClose(); }
              finally { setInstalling(false); }
            }}
            disabled={installing}
          >
            {installing ? 'Installing...' : 'Install'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
