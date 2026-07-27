import { describe, it, expect } from "vitest";

describe("index exports", () => {
  it("re-exports expected symbols", async () => {
    const mod = await import("../src/index.js");
    expect(mod.MDNS_SERVICE_TAG).toBe("orqenix-mesh");
    expect(typeof mod.makeMdnsService).toBe("function");
    expect(typeof mod.parseBootstrapYaml).toBe("function");
    expect(typeof mod.loadBootstrapFile).toBe("function");
    expect(typeof mod.nextReconnectDelay).toBe("function");
    expect(typeof mod.DEFAULT_RECONNECT).toBe("object");
    expect(typeof mod.DiscoveryStateMachine).toBe("function");
    expect(typeof mod.MeshDiscovery).toBe("function");
  });
});
