// SPDX-License-Identifier: Apache-2.0

'use client';

import { Panel, LiveDot } from '@/components/ui';
import { useLiveEvents } from '@/lib/use-live-events';

export function MeshStatus({ peers }: { peers: number }) {
  const { connected } = useLiveEvents();
  return (
    <Panel title="Mesh">
      <div className="flex items-center gap-2">
        <LiveDot on={connected} />
        <span className="font-mono text-data-base font-extrabold text-[var(--ink)]">{peers} peer{peers === 1 ? '' : 's'}</span>
        <span className="font-mono text-data-xs text-[var(--dim)]">{'\u00B7'} libp2p relay</span>
      </div>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: Math.max(1, peers) }).map((_, i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full bg-[var(--olive)] opacity-80" />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-data-xs">
        <div className="rounded-sm bg-[var(--paper)] px-2 py-1.5">
          <div className="text-[var(--faint)]">transport</div>
          <div className="font-bold text-[var(--teal)]">http+libp2p</div>
        </div>
        <div className="rounded-sm bg-[var(--paper)] px-2 py-1.5">
          <div className="text-[var(--faint)]">integrity</div>
          <div className="font-bold text-[var(--olive)]">verified</div>
        </div>
      </div>
    </Panel>
  );
}
