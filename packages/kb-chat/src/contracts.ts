import { z } from "zod";
import { OrqenixError, type Brand } from "@orqenix/core";
import { SCOPE_ID_PATTERN } from "@orqenix/scope-identity";

export type SessionId = Brand<string, "SessionId">;
export type ChatEntryId = Brand<string, "ChatEntryId">;

export const SESSION_ID_PATTERN = /^sess:[A-Z2-7]{32}$/;
export const CHAT_ENTRY_ID_PATTERN = /^ce:[A-Z2-7]{32}$/;

export const ROLES = ["user", "assistant", "system", "tool"] as const;
export type Role = (typeof ROLES)[number];

export interface ChatSession {
  sessionId: SessionId;
  scopeId: string;
  title: string;
  createdAt: string;
  lastEntryAt: string | null;
  entryCount: number;
}

export interface ChatEntry {
  entryId: ChatEntryId;
  sessionId: SessionId;
  role: Role;
  content: string;
  tokens: number | null;
  contentHash: string;
  prevEntryHash: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export const AppendChatEntryInputSchema = z
  .object({
    sessionId: z.string().regex(SESSION_ID_PATTERN),
    role: z.enum(ROLES),
    content: z
      .string()
      .min(1)
      .max(64 * 1024),
    tokens: z.number().int().nonnegative().nullable().optional(),
    metadata: z.record(z.unknown()).default({}),
  })
  .strict();
export type AppendChatEntryInput = z.infer<typeof AppendChatEntryInputSchema>;

export const CreateSessionInputSchema = z
  .object({
    scopeId: z.string().regex(SCOPE_ID_PATTERN),
    title: z.string().min(1).max(256),
  })
  .strict();
export type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;

export class SessionNotFoundError extends OrqenixError {
  constructor(id: string) {
    super(`chat session not found: ${id}`, "SESSION_NOT_FOUND");
  }
}
export class EntryNotFoundError extends OrqenixError {
  constructor(id: string) {
    super(`chat entry not found: ${id}`, "ENTRY_NOT_FOUND");
  }
}
export class ChatWriteUnauthorizedError extends OrqenixError {
  constructor(reason: string) {
    super(`chat write unauthorized: ${reason}`, "CHAT_WRITE_UNAUTH");
  }
}
export class HashChainBrokenError extends OrqenixError {
  constructor(expected: string, actual: string) {
    super(
      `chat entry hash chain broken: expected prev ${expected.slice(0, 12)}..., got ${actual.slice(0, 12)}...`,
      "HASH_CHAIN_BROKEN",
    );
  }
}
