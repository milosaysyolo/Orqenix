import { getPlugins, createPlugin } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json({ plugins: getPlugins() });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { name, version, enabled, description, author } = body;
    const plugin = createPlugin({
      name: name ?? 'new-plugin',
      version: version ?? '1.0.0',
      enabled: enabled ?? true,
      description: description ?? '',
      author: author ?? 'user',
    });
    return Response.json({ plugin }, { status: 201 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}
