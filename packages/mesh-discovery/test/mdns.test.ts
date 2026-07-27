import { describe, it, expect } from "vitest";
import {
  MDNS_SERVICE_TAG,
  MDNS_DEFAULT_INTERVAL_MS,
  MDNS_PEER_RECORD_TTL_MS,
  makeMdnsService,
} from "../src/mdns.js";

describe("mDNS constants", () => {
  it("has locked service tag", () => {
    expect(MDNS_SERVICE_TAG).toBe("orqenix-mesh");
  });
  it("has default interval 10s", () => {
    expect(MDNS_DEFAULT_INTERVAL_MS).toBe(10_000);
  });
  it("has default TTL 30s", () => {
    expect(MDNS_PEER_RECORD_TTL_MS).toBe(30_000);
  });
  it("makeMdnsService returns a service object", () => {
    const svc = makeMdnsService();
    expect(svc).toBeDefined();
    expect(typeof svc).toBe("function");
  });
  it("makeMdnsService accepts custom config", () => {
    const svc = makeMdnsService({ serviceTag: "custom", intervalMs: 5_000 });
    expect(svc).toBeDefined();
  });
});
