// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Error types

/** Base error class for plugin-core errors */
export class PluginError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'PluginError';
    Object.setPrototypeOf(this, PluginError.prototype);
  }
}

/** Plugin manifest invalid (CSF schema violation) */
export class ManifestInvalidError extends PluginError {
  constructor(message: string, public readonly issues?: unknown) {
    super('MANIFEST_INVALID', message);
    Object.setPrototypeOf(this, ManifestInvalidError.prototype);
  }
}

/** Plugin kind not in 14 supported kinds (ADR-E-006) */
export class PluginKindUnsupportedError extends PluginError {
  constructor(kind: string) {
    super(
      'PLUGIN_KIND_UNSUPPORTED',
      `Plugin kind '${kind}' not in 14 supported kinds. Adding new kinds requires CR amendment per ADR-E-006.`
    );
    Object.setPrototypeOf(this, PluginKindUnsupportedError.prototype);
  }
}

/** Plugin package missing or unreadable */
export class PluginNotFoundError extends PluginError {
  constructor(packagePath: string) {
    super(
      'PLUGIN_NOT_FOUND',
      `Plugin not found at ${packagePath}. Check installation or path.`
    );
    Object.setPrototypeOf(this, PluginNotFoundError.prototype);
  }
}

/** Plugin install operation failed (filesystem, dependencies, etc.) */
export class PluginInstallFailedError extends PluginError {
  constructor(packageName: string, reason: string, cause?: unknown) {
    super(
      'PLUGIN_INSTALL_FAILED',
      `Plugin install failed for ${packageName}: ${reason}`,
      cause
    );
    Object.setPrototypeOf(this, PluginInstallFailedError.prototype);
  }
}

/** Plugin activate operation failed (sandbox spawn, script error, etc.) */
export class PluginActivateFailedError extends PluginError {
  constructor(packageName: string, reason: string, cause?: unknown) {
    super(
      'PLUGIN_ACTIVATE_FAILED',
      `Plugin activate failed for ${packageName}: ${reason}`,
      cause
    );
    Object.setPrototypeOf(this, PluginActivateFailedError.prototype);
  }
}

/** Plugin sandbox crashed during execution */
export class PluginCrashedError extends PluginError {
  constructor(
    packageName: string,
    public readonly exitCode: number | null,
    public readonly signal: NodeJS.Signals | null,
    public readonly stderr: string
  ) {
    super(
      'PLUGIN_CRASHED',
      `Plugin ${packageName} crashed (exit=${exitCode}, signal=${signal}). stderr: ${stderr.slice(0, 200)}`
    );
    Object.setPrototypeOf(this, PluginCrashedError.prototype);
  }
}

/** Plugin invocation exceeded wall-time limit */
export class PluginTimeoutError extends PluginError {
  constructor(packageName: string, timeoutMs: number) {
    super(
      'PLUGIN_TIMEOUT',
      `Plugin ${packageName} exceeded wall-time limit of ${timeoutMs}ms`
    );
    Object.setPrototypeOf(this, PluginTimeoutError.prototype);
  }
}

/** Plugin input doesn't match declared inputSchema */
export class PluginInvalidInputError extends PluginError {
  constructor(packageName: string, public readonly issues: unknown) {
    super(
      'PLUGIN_INVALID_INPUT',
      `Plugin ${packageName} received input violating declared inputSchema`
    );
    Object.setPrototypeOf(this, PluginInvalidInputError.prototype);
  }
}

/** Plugin output doesn't match declared outputSchema */
export class PluginInvalidOutputError extends PluginError {
  constructor(packageName: string, public readonly issues: unknown) {
    super(
      'PLUGIN_INVALID_OUTPUT',
      `Plugin ${packageName} returned output violating declared outputSchema`
    );
    Object.setPrototypeOf(this, PluginInvalidOutputError.prototype);
  }
}

/** Plugin already registered (duplicate install) */
export class PluginAlreadyRegisteredError extends PluginError {
  constructor(packageName: string) {
    super(
      'PLUGIN_ALREADY_REGISTERED',
      `Plugin ${packageName} is already registered. Update via plugin.update() or uninstall first.`
    );
    Object.setPrototypeOf(this, PluginAlreadyRegisteredError.prototype);
  }
}

/** Plugin not registered (uninstall, deactivate of unknown plugin) */
export class PluginNotRegisteredError extends PluginError {
  constructor(packageName: string) {
    super(
      'PLUGIN_NOT_REGISTERED',
      `Plugin ${packageName} is not registered.`
    );
    Object.setPrototypeOf(this, PluginNotRegisteredError.prototype);
  }
}

/** Plugin sandbox failed conformance check */
export class PluginConformanceFailedError extends PluginError {
  constructor(packageName: string, failures: string[]) {
    super(
      'PLUGIN_CONFORMANCE_FAILED',
      `Plugin ${packageName} failed conformance: ${failures.join('; ')}`
    );
    Object.setPrototypeOf(this, PluginConformanceFailedError.prototype);
  }
}
