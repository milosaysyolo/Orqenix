// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme';
import { AppShell } from '@/components/app-shell';

export const metadata: Metadata = {
  title: 'Orqenix Workbench',
  description: 'Local mission control for AI engineering — memory, agents, marketplace, self-learning.',
  applicationName: 'Orqenix Workbench',
  authors: [{ name: 'Milo Nguyen' }],
  generator: 'Next.js',
  keywords: ['orqenix', 'workbench', 'ai-coding', 'local-first', 'memory', 'mesh'],
  themeColor: '#f6f4ee',
  colorScheme: 'light dark',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider><AppShell>{children}</AppShell></ThemeProvider>
      </body>
    </html>
  );
}
