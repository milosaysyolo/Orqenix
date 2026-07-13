export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json({
    available: true,
    projects: ['orqenix-main', 'orqenix-staging'],
    candidates: [],
  });
}
