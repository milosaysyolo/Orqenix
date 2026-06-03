export type Brand<T, Tag extends string> = T & { readonly __brand: Tag };

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function brand<T extends Brand<unknown, string>>(
  value: T extends Brand<infer U, string> ? U : never,
): T {
  return value as unknown as T;
}

export function unbrand<T extends Brand<unknown, string>>(
  value: T,
): T extends Brand<infer U, string> ? U : never {
  return value as T extends Brand<infer U, string> ? U : never;
}

export type ContentHash = Brand<string, "ContentHash">;
export type SessionId = Brand<string, "SessionId">;
export type TokenId = Brand<string, "TokenId">;
export type EntryId = Brand<string, "EntryId">;
export type UserId = Brand<string, "UserId">;
export type DecisionId = Brand<string, "DecisionId">;
