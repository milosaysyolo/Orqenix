// SPDX-License-Identifier: Apache-2.0
// Workbench health endpoint , used by local checks and load balancers if proxied

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: '@orqenix/workbench',
      version: '0.8.0-alpha.1',
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
