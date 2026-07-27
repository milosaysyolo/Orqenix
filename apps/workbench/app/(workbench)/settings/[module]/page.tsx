// SPDX-License-Identifier: Apache-2.0

import { SettingsModulePage } from '@/components/settings-module-page';

type Params = Promise<{ module: string }>;

const MODULE_MAP: Record<string, string> = {
  memory: '@orqenix/memory-distiller',
  plugins: '@orqenix/plugin-core',
  'self-learning': '@orqenix/self-learning-observer',
  'cloud-sync': '@orqenix-cloud/relay',
  search: '@orqenix/search-hybrid',
  storage: '@orqenix/storage-sqlite',
  mesh: '@orqenix/mesh-routing',
};

export default async function SettingsModuleRoute({ params }: { params: Params }) {
  const { module } = await params;
  const moduleId = MODULE_MAP[module] ?? `@orqenix/${module}`;
  return <SettingsModulePage moduleId={moduleId} />;
}
