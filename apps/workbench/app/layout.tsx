// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Orqenix Workbench',
  description: 'Local-first Web UI for project memory, mesh, audit, and marketplace',
  applicationName: 'Orqenix Workbench',
  authors: [{ name: 'Milo Nguyen' }],
  generator: 'Next.js',
  keywords: ['orqenix', 'workbench', 'ai-coding', 'local-first', 'memory', 'mesh'],
  themeColor: '#0c0c0d',
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
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
