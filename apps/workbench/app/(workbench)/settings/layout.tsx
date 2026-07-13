// SPDX-License-Identifier: Apache-2.0

'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card, Badge } from '@/components/ui';
import { api } from '@/lib/api';

const SETTINGS_TABS = [
  { href: '/settings/memory', label: 'Memory', moduleId: '@orqenix/memory-engine' },
  { href: '/settings/storage', label: 'Storage', moduleId: '@orqenix/storage-diff' },
  { href: '/settings/search', label: 'Search', moduleId: '@orqenix/search-hybrid' },
  { href: '/settings/mesh', label: 'Mesh', moduleId: '@orqenix/mesh' },
  { href: '/settings/cloud-sync', label: 'Cloud Sync', moduleId: '@orqenix-cloud/relay' },
  { href: '/settings/self-learning', label: 'Self-Learning', moduleId: '@orqenix/self-learning-observer' },
  { href: '/settings/plugins', label: 'Plugins', moduleId: '@orqenix/plugin-core' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [counts, setCounts] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    let cancelled = false;
    api.get<{ groups: Array<{ moduleId: string; settings: unknown[] }> }>('/api/settings').then((res) => {
      if (cancelled || !res.ok || !res.data) return;
      const map: Record<string, number> = {};
      for (const g of res.data.groups) map[g.moduleId] = g.settings.length;
      setCounts(map);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <Link href="/settings" className="font-serif text-[22px] font-semibold text-[var(--ink)] no-underline hover:text-[var(--rust)]">
        Settings
      </Link>

      <div className="mt-4 grid grid-cols-[210px_1fr] gap-4">
        <Card className="h-fit p-2">
          {SETTINGS_TABS.map((tab) => {
            const active = pathname === tab.href || (tab.href === '/settings/memory' && pathname === '/settings');
            const count = counts[tab.moduleId];
            return (
              <Link key={tab.href} href={tab.href}
                className={'flex items-center justify-between rounded-[7px] px-3 py-1.5 font-mono text-[11px] no-underline transition-colors ' +
                  (active ? 'bg-[color-mix(in_oklab,var(--rust)8%,transparent)] font-bold text-[var(--rust)]' : 'text-[var(--dim)] hover:text-[var(--ink)]')}>
                <span>{tab.label}</span>
                {count != null && <Badge tone="neutral">{count}</Badge>}
              </Link>
            );
          })}
        </Card>

        <div>{children}</div>
      </div>
    </div>
  );
}
