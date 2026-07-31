// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { ImportExportWizard } from "../src/import-export-wizard";

describe("ImportExportWizard", () => {
  it("is a valid React component", () => {
    expect(typeof ImportExportWizard).toBe("function");
  });

  it("creates import mode element without crashing", () => {
    const element = createElement(ImportExportWizard, {
      mode: "import",
      open: true,
      onClose: vi.fn(),
    });
    expect(element).toBeDefined();
  });

  it("creates export mode element without crashing", () => {
    const element = createElement(ImportExportWizard, {
      mode: "export",
      open: true,
      pluginName: "test-plugin",
      onClose: vi.fn(),
    });
    expect(element).toBeDefined();
  });
});
