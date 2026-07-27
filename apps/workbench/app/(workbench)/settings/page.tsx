// SPDX-License-Identifier: Apache-2.0

// The /settings main route delegates to the shared module renderer so the
// landing view shows real settings content (consistent with the /settings/<module>
// sub-routes). The left rail is owned by settings/layout.tsx.

import { SettingsModulePage } from '@/components/settings-module-page';

export default function SettingsPage() {
  return <SettingsModulePage moduleId="@orqenix/memory-engine" />;
}
