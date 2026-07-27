// SPDX-License-Identifier: Apache-2.0
// Phase 4: cross-project learning candidates (via demo-store)

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json({
    available: true,
    projects: ['orqenix-main', 'orqenix-staging'],
    candidates: [],
  });
}
