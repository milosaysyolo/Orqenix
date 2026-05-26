export async function resolveEmbedder(cfg: any): Promise<any> {
  if (cfg.primary === "cloud" && cfg.cloud) {
    try {
      return await import("@orqenix/embedding-cloud").then(m =>
        m.createCloudEmbedder(cfg.cloud),
      );
    } catch {
      return import("@orqenix/embedding-local").then(m => m.createLocalEmbedder());
    }
  }
  return import("@orqenix/embedding-local").then(m => m.createLocalEmbedder());
}
