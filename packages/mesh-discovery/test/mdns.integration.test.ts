/**
 * NOTE: mDNS rarely works inside CI runners (multicast blocked, container netns).
 * This test is OPT-IN: it only runs when RUN_MDNS=1 is set (real LAN local dev).
 * CI stays green without multicast support.
 */
import { describe, it, expect } from "vitest";
import { createLibp2p } from "libp2p";
import { tcp } from "@libp2p/tcp";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { makeMdnsService, MDNS_SERVICE_TAG } from "../src/mdns.js";

const RUN = process.env.RUN_MDNS ? it : it.skip;

describe("mDNS integration (optional)", () => {
  RUN(
    "two libp2p nodes discover each other within 5s",
    async () => {
      const mk = async () =>
        createLibp2p({
          addresses: { listen: ["/ip4/127.0.0.1/tcp/0"] },
          transports: [tcp()],
          connectionEncrypters: [noise()],
          streamMuxers: [yamux()],
          services: { mdns: makeMdnsService({ serviceTag: MDNS_SERVICE_TAG, intervalMs: 500 }) },
        });

      const A = await mk();
      const B = await mk();
      await A.start();
      await B.start();

      const found = await new Promise<boolean>((resolve) => {
        const t = setTimeout(() => resolve(false), 5_000);
        A.addEventListener("peer:discovery", () => {
          clearTimeout(t);
          resolve(true);
        });
      });

      expect(found).toBe(true);

      await A.stop();
      await B.stop();
    },
    10_000,
  );
});
