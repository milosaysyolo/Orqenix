// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { invoke } from "../src/index";

describe("python-analyzer reference plugin", () => {
  const sample = `import os
from typing import Optional

class MyClass:
    def my_method(self):
        pass

def my_function():
    pass
`;

  it("extracts functions", async () => {
    const result = await invoke({ source: sample });
    expect(result.functions).toContain("my_function");
    expect(result.functions).toContain("my_method");
  });

  it("extracts classes", async () => {
    const result = await invoke({ source: sample });
    expect(result.classes).toContain("MyClass");
  });

  it("extracts imports", async () => {
    const result = await invoke({ source: sample });
    expect(result.imports).toContain("os");
    expect(result.imports).toContain("typing");
  });

  it("returns empty arrays for empty source", async () => {
    const result = await invoke({ source: "" });
    expect(result.functions).toEqual([]);
    expect(result.classes).toEqual([]);
    expect(result.imports).toEqual([]);
  });
});
