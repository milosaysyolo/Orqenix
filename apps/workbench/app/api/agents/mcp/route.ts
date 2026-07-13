import { getMCPServers, getMCPPrompts, getMCPTokens } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const servers = getMCPServers();
  return Response.json({
    status: 'running',
    endpoint: 'http://127.0.0.1:8921',
    transports: [
      { kind: 'stdio', state: 'connected' },
      { kind: 'sse', state: 'connected', port: 8921 },
    ],
    tools: servers.filter((s) => s.enabled).flatMap((s) =>
      Array.from({ length: s.tools }, (_, i) => ({
        name: `${s.name}:tool_${i}`,
        description: `${s.name} tool #${i + 1}`,
        permission: 'user',
      }))
    ),
    resources: servers.filter((s) => s.enabled).flatMap((s) =>
      Array.from({ length: s.resources }, (_, i) => ({
        uri: `${s.name}://resource/${i}`,
        description: `${s.name} resource #${i + 1}`,
      }))
    ),
    prompts: getMCPPrompts(),
    tokens: getMCPTokens(),
  });
}
