// SPDX-License-Identifier: Apache-2.0
// Workbench landing page , redirects to dashboard or first-launch wizard

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FirstLaunchWizard } from '@/components/first-launch-wizard';

export default function HomePage() {
  const router = useRouter();
  const [showWizard, setShowWizard] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if first-launch wizard has been completed
    const wizardCompleted = localStorage.getItem('orqenix-workbench:first-launch-completed');
    if (wizardCompleted === 'true') {
      // Already onboarded, redirect to default tab (Memory)
      router.replace('/memory');
      setShowWizard(false);
    } else {
      setShowWizard(true);
    }
  }, [router]);

  if (showWizard === null) {
    return null; // Loading state
  }

  if (showWizard) {
    return <FirstLaunchWizard onComplete={() => {
      localStorage.setItem('orqenix-workbench:first-launch-completed', 'true');
      router.replace('/memory');
    }} />;
  }

  return null;
}
