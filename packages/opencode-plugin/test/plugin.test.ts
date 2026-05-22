import { describe, it, expect } from "vitest";
import OrqenixOpenCodePlugin from "../src/index.js";

describe("OrqenixOpenCodePlugin", () => {
  it("returns hooks object", async () => {
    const hooks = await OrqenixOpenCodePlugin({});
    expect(hooks["session.start"]).toBeTypeOf("function");
    expect(hooks["tool.execute.before"]).toBeTypeOf("function");
    expect(hooks["tool.execute.after"]).toBeTypeOf("function");
  });
});
