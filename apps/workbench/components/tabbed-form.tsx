// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// TABBED FORM — shared tabbed form container for modals.
// Extracted from duplicate definitions across agents/subagents page.
// Provides consistent tabbed form UX with pill-style tab bar.
// ============================================================================

'use client';

import * as React from 'react';

interface Tab {
  key: string;
  label: string;
  content: React.ReactNode;
}

interface TabbedFormProps {
  tabs: Tab[];
  footer: React.ReactNode;
}

export function TabbedForm({ tabs, footer }: TabbedFormProps) {
  const [active, setActive] = React.useState(tabs[0]?.key ?? '');

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-[7px] bg-[var(--paper2)] p-0.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`flex-1 rounded-[5px] px-3 py-1 font-mono text-[10px] font-semibold transition-colors ${
              active === t.key
                ? 'bg-[var(--card)] text-[var(--ink)] shadow-sm'
                : 'text-[var(--dim)] hover:text-[var(--ink)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[200px]">
        {tabs.find((t) => t.key === active)?.content}
      </div>

      {/* Footer */}
      {footer}
    </div>
  );
}
