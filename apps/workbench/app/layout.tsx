// SPDX-License-Identifier: Apache-2.0

import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme';
import { ToastProvider } from '@/components/toast';
import { AppShell } from '@/components/app-shell';

export const metadata: Metadata = {
  title: 'Orqenix Workbench',
  description: 'Live operations cockpit for AI engineering — memory, agents, marketplace, self-learning.',
  applicationName: 'Orqenix Workbench',
  generator: 'Next.js',
  keywords: ['orqenix', 'workbench', 'ai-coding', 'local-first', 'memory', 'mesh'],
  formatDetection: { email: false, address: false, telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#f6f4ee',
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
