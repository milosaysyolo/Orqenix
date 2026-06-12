// SPDX-License-Identifier: Apache-2.0
// Settings landing page , redirects to first sub-tab (Memory)

import { redirect } from 'next/navigation';

export default function SettingsPage() {
  redirect('/settings/memory');
}
