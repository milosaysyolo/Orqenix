import { OrqenixMcpServer } from '@orqenix/mcp-server';
import { SkillRuntime } from '@orqenix/skill-runtime';
import {
  getMemory,
  getPluginRegistrySync,
  listMcpTokens,
} from '@/lib/engine-init';

export const dynamic = 'force-dynamic';

declare global {
  // eslint-disable-next-line no-var
  var __orqenixMcpServer: OrqenixMcpServer | undefined;
}

async function getMcpServer(): Promise<OrqenixMcpServer> {
  if (globalThis.__orqenixMcpServer) return globalThis.__orqenixMcpServer;

  const engine = await getMemory();
  if (!engine) throw new Error('MemoryEngine unavailable');

  const skillRuntime = new SkillRuntime({
    engine,
    registry: getPluginRegistrySync() ?? undefined,
  });

  const server = new OrqenixMcpServer({
    engine,
    skillRuntime,
    transport: 'stdio',
  });
  globalThis.__orqenixMcpServer = server;
  return server;
}

export async function GET(): Promise<Response> {
  let server: OrqenixMcpServer | null = null;
  try {
    server = await getMcpServer();
  } catch {
    // Engine not ready — return empty state
  }

  return Response.json({
    status: server ? 'running' : 'unavailable',
    endpoint: server ? 'http://127.0.0.1:27420' : '',
    transports: server
      ? [{ kind: 'stdio', state: 'connected' }]
      : [],
    tools: server
      ? server.listTools().map((t: { name: string; description: string }) => ({
          name: t.name,
          description: t.description,
          permission: 'user' as const,
        }))
      : [],
    resources: server
      ? server.listResources().map((r: { uri: string; description: string }) => ({
          uri: r.uri,
          description: r.description,
        }))
      : [],
    prompts: server
      ? server.listPrompts().map((p: { name: string; description: string }) => ({
          name: p.name,
          description: p.description,
        }))
      : [],
    tokens: await listMcpTokens(),
  });
}
