// SPDX-License-Identifier: Apache-2.0
// @orqenix/local-memory-federation , Project discovery
//
// Reads ~/.orqenix/projects.yaml to find projects user has registered for
// federation. Pure read-only operation; never modifies the registry directly.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import {
  ProjectId,
  ProjectRegistration,
  ProjectsYaml,
  ProjectsYamlSchema,
} from './types';
import { ProjectNotFoundError, RegistryError } from './errors';

/**
 * Discovers projects from the local registry.
 *
 * Default registry path: ~/.orqenix/projects.yaml
 *
 * Format:
 *   projects:
 *     - id: blake3:7f2ac8d100000000
 *       name: orqenix-cloud
 *       path: /home/milo/code/Orqenix-Cloud
 *       registered_at: 2026-06-10T12:00:00Z
 *       cross_project_sharing_enabled: false
 */
export class ProjectDiscovery {
  private readonly registryPath: string;

  constructor(registryPath?: string) {
    this.registryPath =
      registryPath ?? join(homedir(), '.orqenix', 'projects.yaml');
  }

  /** Returns all registered projects, or empty array if registry doesn't exist */
  async listProjects(): Promise<ProjectRegistration[]> {
    if (!existsSync(this.registryPath)) {
      return [];
    }

    let content: string;
    try {
      content = await readFile(this.registryPath, 'utf-8');
    } catch (err) {
      throw new RegistryError(
        `Failed to read project registry at ${this.registryPath}`,
        err
      );
    }

    let parsed: unknown;
    try {
      parsed = parseYaml(content);
    } catch (err) {
      throw new RegistryError(
        `Failed to parse YAML in ${this.registryPath}`,
        err
      );
    }

    const validated = ProjectsYamlSchema.safeParse(parsed);
    if (!validated.success) {
      throw new RegistryError(
        `Invalid schema in ${this.registryPath}: ${validated.error.message}`,
        validated.error
      );
    }

    return validated.data.projects;
  }

  /** Returns only projects with cross-project sharing enabled */
  async listFederationEnabledProjects(): Promise<ProjectRegistration[]> {
    const all = await this.listProjects();
    return all.filter((p) => p.cross_project_sharing_enabled);
  }

  /** Finds a single project by ID; throws if not found */
  async findProject(projectId: ProjectId): Promise<ProjectRegistration> {
    const all = await this.listProjects();
    const project = all.find((p) => p.id === projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }
    return project;
  }

  /** Registers a new project in the registry. Creates the file if needed. */
  async registerProject(registration: ProjectRegistration): Promise<void> {
    const dir = dirname(this.registryPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const existing = (await this.listProjects()).filter(
      (p) => p.id !== registration.id
    );
    const yaml: ProjectsYaml = {
      projects: [...existing, registration],
    };

    try {
      await writeFile(
        this.registryPath,
        stringifyYaml(yaml, { indent: 2 }),
        'utf-8'
      );
    } catch (err) {
      throw new RegistryError(
        `Failed to write project registry at ${this.registryPath}`,
        err
      );
    }
  }

  /** Toggles federation enablement for a project */
  async setFederationEnabled(
    projectId: ProjectId,
    enabled: boolean
  ): Promise<void> {
    const all = await this.listProjects();
    const target = all.find((p) => p.id === projectId);
    if (!target) {
      throw new ProjectNotFoundError(projectId);
    }
    target.cross_project_sharing_enabled = enabled;

    try {
      await writeFile(
        this.registryPath,
        stringifyYaml({ projects: all }, { indent: 2 }),
        'utf-8'
      );
    } catch (err) {
      throw new RegistryError(
        `Failed to write project registry at ${this.registryPath}`,
        err
      );
    }
  }
}
