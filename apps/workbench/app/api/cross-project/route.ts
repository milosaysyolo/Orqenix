export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json({
    projects: [
      { id: 'proj_orqenix', name: 'orqenix-main', sharing: true, online: true, self: true },
      { id: 'proj_staging', name: 'orqenix-staging', sharing: false, online: true },
      { id: 'proj_legacy', name: 'legacy-v1', sharing: false, online: false },
    ],
  });
}
