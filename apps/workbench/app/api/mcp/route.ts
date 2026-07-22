// SPDX-License-Identifier: Apache-2.0

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json({ status: 'ok', transport: 'stdio' });
}
