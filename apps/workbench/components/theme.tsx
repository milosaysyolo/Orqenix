// SPDX-License-Identifier: Apache-2.0

'use client';

import * as React from 'react';
import { ThemeProvider as NextThemes } from 'next-themes';
import { Button } from './ui';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <NextThemes attribute="class" defaultTheme="light" enableSystem={false}>{children}</NextThemes>;
}

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<string>('light');
  React.useEffect(() => {
    let cancelled = false;
    const sync = () => {
      if (cancelled) return;
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => { cancelled = true; obs.disconnect(); };
  }, []);

  const toggle = () => {
    const isDark = document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', !isDark);
  };

  return (
    <Button size="sm" variant="ghost" onClick={toggle} aria-label="Toggle theme">
      {theme === 'dark' ? '\u263C' : '\u263D'}
    </Button>
  );
}
