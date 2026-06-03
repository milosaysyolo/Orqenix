export class OrqenixError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "OrqenixError";
    this.code = code;
    this.context = context;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}

export class ValidationError extends OrqenixError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", context);
    this.name = "ValidationError";
  }
}

export class ConfigurationError extends OrqenixError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "CONFIGURATION_ERROR", context);
    this.name = "ConfigurationError";
  }
}

export class StateError extends OrqenixError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "STATE_ERROR", context);
    this.name = "StateError";
  }
}

export class NotFoundError extends OrqenixError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "NOT_FOUND", context);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends OrqenixError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "CONFLICT", context);
    this.name = "ConflictError";
  }
}

export class TimeoutError extends OrqenixError {
  public readonly timeoutMs: number;
  constructor(timeoutMs: number, context?: Record<string, unknown>) {
    super(`Operation timed out after ${timeoutMs}ms`, "TIMEOUT", context);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class PermissionError extends OrqenixError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "PERMISSION_DENIED", context);
    this.name = "PermissionError";
  }
}

export class InternalError extends OrqenixError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "INTERNAL_ERROR", context);
    this.name = "InternalError";
  }
}

export function isOrqenixError(value: unknown): value is OrqenixError {
  return value instanceof OrqenixError;
}

export function ensureOrqenixError(value: unknown): OrqenixError {
  if (isOrqenixError(value)) return value;
  if (value instanceof Error) {
    return new InternalError(value.message, { originalError: value.name });
  }
  return new InternalError(String(value));
}
