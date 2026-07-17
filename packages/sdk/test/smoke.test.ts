// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { PACKAGE_VERSION } from "../src/index.js";

describe("@orqenix/sdk", () => {
  it("exports PACKAGE_VERSION as a string", () => {
    expect(PACKAGE_VERSION).toBe("0.5.0-phase-5");
  });
});
