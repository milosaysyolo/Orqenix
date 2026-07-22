// SPDX-License-Identifier: Apache-2.0

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json({
    stages: [{ name: 'recall', status: 'ok' }, { name: 'distill', status: 'ok' }],
  });
}
