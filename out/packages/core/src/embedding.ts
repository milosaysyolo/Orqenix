export async function resolveEmbedder(cfg: any): Promise<any> {
  if (cfg.primary === "cloud" && cfg.cloud) {
    try {
      // @ts-expect-error dynamic import
      return await import("@orqenix/embedding-cloud").then(m =>
        m.createCloudEmbedder(cfg.cloud),
      );
    } catch {
      // @ts-expect-error dynamic import
      return import("@orqenix/embedding-local").then(m => m.createLocalEmbedder());
    }
  }
  // @ts-expect-error dynamic import
  return import("@orqenix/embedding-local").then(m => m.createLocalEmbedder());
}
