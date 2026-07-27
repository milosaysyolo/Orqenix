// SPDX-License-Identifier: Apache-2.0
// Tests for ProjectDiscovery

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stringify as stringifyYaml } from "yaml";
import { ProjectDiscovery } from "../src/project-discovery";
import { ProjectNotFoundError, RegistryError } from "../src/errors";
import type { ProjectId } from "../src/types";

const PROJECT_A = "blake3:aaaaaaaa00000000" as ProjectId;
const PROJECT_B = "blake3:bbbbbbbb00000000" as ProjectId;

describe("ProjectDiscovery", () => {
  let tmpDir: string;
  let registryPath: string;
  let discovery: ProjectDiscovery;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "orqenix-disc-test-"));
    registryPath = join(tmpDir, "projects.yaml");
    discovery = new ProjectDiscovery(registryPath);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when registry does not exist", async () => {
    const projects = await discovery.listProjects();
    expect(projects).toEqual([]);
  });

  it("reads and parses a valid registry", async () => {
    await writeFile(
      registryPath,
      stringifyYaml({
        projects: [
          {
            id: PROJECT_A,
            name: "orqenix-cloud",
            path: "/home/milo/code/Orqenix-Cloud",
            registered_at: "2026-06-10T12:00:00Z",
            cross_project_sharing_enabled: false,
          },
          {
            id: PROJECT_B,
            name: "orqenix-os",
            path: "/home/milo/code/Orqenix",
            registered_at: "2026-06-11T09:00:00Z",
            cross_project_sharing_enabled: true,
          },
        ],
      }),
    );

    const projects = await discovery.listProjects();
    expect(projects).toHaveLength(2);
    expect(projects[0]?.id).toBe(PROJECT_A);
    expect(projects[1]?.id).toBe(PROJECT_B);
  });

  it("throws RegistryError on invalid YAML", async () => {
    await writeFile(registryPath, "this is not: valid: yaml: at all: oops");
    await expect(discovery.listProjects()).rejects.toThrow();
  });

  it("throws RegistryError on schema violation", async () => {
    await writeFile(
      registryPath,
      stringifyYaml({
        projects: [
          {
            id: "invalid-no-blake3-prefix",
            name: "oops",
          },
        ],
      }),
    );
    await expect(discovery.listProjects()).rejects.toBeInstanceOf(RegistryError);
  });

  it("filters federation-enabled projects", async () => {
    await writeFile(
      registryPath,
      stringifyYaml({
        projects: [
          {
            id: PROJECT_A,
            name: "p1",
            path: "/a",
            registered_at: "2026-06-10T12:00:00Z",
            cross_project_sharing_enabled: false,
          },
          {
            id: PROJECT_B,
            name: "p2",
            path: "/b",
            registered_at: "2026-06-11T12:00:00Z",
            cross_project_sharing_enabled: true,
          },
        ],
      }),
    );

    const enabled = await discovery.listFederationEnabledProjects();
    expect(enabled).toHaveLength(1);
    expect(enabled[0]?.id).toBe(PROJECT_B);
  });

  it("finds a project by ID", async () => {
    await writeFile(
      registryPath,
      stringifyYaml({
        projects: [
          {
            id: PROJECT_A,
            name: "p1",
            path: "/a",
            registered_at: "2026-06-10T12:00:00Z",
            cross_project_sharing_enabled: false,
          },
        ],
      }),
    );

    const project = await discovery.findProject(PROJECT_A);
    expect(project.id).toBe(PROJECT_A);
    expect(project.name).toBe("p1");
  });

  it("throws ProjectNotFoundError for missing project", async () => {
    await writeFile(
      registryPath,
      stringifyYaml({
        projects: [
          {
            id: PROJECT_A,
            name: "p1",
            path: "/a",
            registered_at: "2026-06-10T12:00:00Z",
            cross_project_sharing_enabled: false,
          },
        ],
      }),
    );

    await expect(discovery.findProject(PROJECT_B)).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("registers a new project (creates registry file)", async () => {
    await discovery.registerProject({
      id: PROJECT_A,
      name: "new-project",
      path: "/home/milo/new",
      registered_at: "2026-06-11T15:00:00Z",
      cross_project_sharing_enabled: false,
    });

    const projects = await discovery.listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0]?.id).toBe(PROJECT_A);
  });

  it("registering same ID replaces (no duplicates)", async () => {
    await discovery.registerProject({
      id: PROJECT_A,
      name: "v1",
      path: "/v1",
      registered_at: "2026-06-10T12:00:00Z",
      cross_project_sharing_enabled: false,
    });

    await discovery.registerProject({
      id: PROJECT_A,
      name: "v2",
      path: "/v2",
      registered_at: "2026-06-11T12:00:00Z",
      cross_project_sharing_enabled: true,
    });

    const projects = await discovery.listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0]?.name).toBe("v2");
    expect(projects[0]?.cross_project_sharing_enabled).toBe(true);
  });

  it("toggles federation enablement", async () => {
    await discovery.registerProject({
      id: PROJECT_A,
      name: "p1",
      path: "/a",
      registered_at: "2026-06-10T12:00:00Z",
      cross_project_sharing_enabled: false,
    });

    await discovery.setFederationEnabled(PROJECT_A, true);

    const project = await discovery.findProject(PROJECT_A);
    expect(project.cross_project_sharing_enabled).toBe(true);
  });
});
