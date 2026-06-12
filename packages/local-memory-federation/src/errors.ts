// SPDX-License-Identifier: Apache-2.0
// @orqenix/local-memory-federation , Error types

/** Base error class for federation errors */
export class FederationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'FederationError';
    Object.setPrototypeOf(this, FederationError.prototype);
  }
}

/** Cross-project federation not enabled for this project */
export class FederationDisabledError extends FederationError {
  constructor(projectId: string) {
    super(
      'FEDERATION_DISABLED',
      `Cross-project federation is disabled for project ${projectId}. Enable via Workbench Settings → Mesh → Cross-project sharing.`
    );
    Object.setPrototypeOf(this, FederationDisabledError.prototype);
  }
}

/** No approval exists between the requested project pair */
export class NoApprovalError extends FederationError {
  constructor(sourceProjectId: string, targetProjectId: string) {
    super(
      'NO_APPROVAL',
      `No approval exists for federation between source=${sourceProjectId} and target=${targetProjectId}. User must approve in Workbench before sharing.`
    );
    Object.setPrototypeOf(this, NoApprovalError.prototype);
  }
}

/** Approval exists but has expired */
export class ExpiredApprovalError extends FederationError {
  constructor(approvalExpiresAt: string) {
    super(
      'APPROVAL_EXPIRED',
      `Federation approval expired at ${approvalExpiresAt}. User must re-approve.`
    );
    Object.setPrototypeOf(this, ExpiredApprovalError.prototype);
  }
}

/** Project not found in registry */
export class ProjectNotFoundError extends FederationError {
  constructor(projectId: string) {
    super(
      'PROJECT_NOT_FOUND',
      `Project ${projectId} not found in ~/.orqenix/projects.yaml. Register the project first.`
    );
    Object.setPrototypeOf(this, ProjectNotFoundError.prototype);
  }
}

/** Registry file invalid or unreadable */
export class RegistryError extends FederationError {
  constructor(message: string, cause?: unknown) {
    super('REGISTRY_ERROR', message, cause);
    Object.setPrototypeOf(this, RegistryError.prototype);
  }
}

/** Candidate not found by ID */
export class CandidateNotFoundError extends FederationError {
  constructor(candidateId: string) {
    super(
      'CANDIDATE_NOT_FOUND',
      `Candidate ${candidateId} not found. It may have been cleared from cache or never existed.`
    );
    Object.setPrototypeOf(this, CandidateNotFoundError.prototype);
  }
}

/** Permission check failure */
export class PermissionError extends FederationError {
  constructor(message: string) {
    super('PERMISSION_DENIED', message);
    Object.setPrototypeOf(this, PermissionError.prototype);
  }
}
