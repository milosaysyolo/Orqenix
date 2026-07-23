// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { PACKAGE_VERSION } from "../src/index.js";

describe("@orqenix/security", () => {
  it("exports PACKAGE_VERSION as a string", () => {
    expect(PACKAGE_VERSION).toBe("0.9.0");
  });
});
