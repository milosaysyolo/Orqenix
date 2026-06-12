// SPDX-License-Identifier: Apache-2.0
// Workbench info endpoint , returns environment and configuration info

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const info = {
    application: '@orqenix/workbench',
    version: '0.8.0-alpha.1',
    crVersion: 'v8.0',
    phase: 8,
    subPhase: 'α',
    deliveryPart: 'D8.α.1',
    port: process.env.PORT || '27420',
    hostname: process.env.HOSTNAME || '127.0.0.1',
    license: 'Apache-2.0',
    repository: 'https://github.com/milosaysyolo/Orqenix',
    documentation: 'https://orqenix.dev/docs/workbench',
    features: {
      memoryHierarchy: true,
      marketplace: true,
      agentEcosystem: true,
      selfLearning: true,
      offlineFirst: true,
      mcpServer: true,
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(info, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=60',
    },
  });
}
