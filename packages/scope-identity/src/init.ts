import { mkdir, writeFile, readFile, access, appendFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import {
  type ScopeYaml,
  type ScopeId,
  type Ed25519KeyPair,
  KeyPairMismatchError,
  ScopeYamlCorruptError,
} from "./contracts.js";
import {
  generateKeyPair,
  serializePrivateKey,
  deserializePrivateKey,
  serializePublicKey,
  verifyKeyPair,
} from "./keypair.js";
import { deriveScopeId } from "./scope-id.js";
import { loadScopeYaml, saveScopeYaml, verifyScopeYamlConsistency } from "./scope-yaml.js";

export interface InitScopeOptions {
  rootDir: string;
  name: string;
  parentScope?: ScopeId | null;
  metadata?: { description?: string; tags?: string[] };
}

export interface InitScopeResult {
  scopeId: ScopeId;
  scopeYamlPath: string;
  identityKeyPath: string;
}

const ORQENIX_DIR = ".orqenix";
const SCOPE_YAML = "scope.yaml";
const IDENTITY_KEY = "identity.key";
const GITIGNORE_LINES = [
  "# Orqenix identity (NEVER commit)",
  ".orqenix/identity.key",
  ".orqenix/*.tmp",
  ".orqenix/gate-reports/",
];

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureGitignore(rootDir: string): Promise<void> {
  const gi = join(rootDir, ".gitignore");
  const existing = (await fileExists(gi)) ? await readFile(gi, "utf-8") : "";
  const toAdd = GITIGNORE_LINES.filter((line) => !existing.includes(line));
  if (toAdd.length > 0) {
    const block =
      (existing.endsWith("\n") || existing === "" ? "" : "\n") + toAdd.join("\n") + "\n";
    await appendFile(gi, block);
  }
}

export async function initScope(opts: InitScopeOptions): Promise<InitScopeResult> {
  const orqDir = join(opts.rootDir, ORQENIX_DIR);
  const scopeYamlPath = join(orqDir, SCOPE_YAML);
  const identityKeyPath = join(orqDir, IDENTITY_KEY);

  if (await fileExists(scopeYamlPath)) {
    throw new Error(`scope already initialized at ${scopeYamlPath} (refusing to clobber)`);
  }

  await mkdir(orqDir, { recursive: true });

  const keyPair = await generateKeyPair();
  const scopeId = deriveScopeId(keyPair.publicKey);
  const publicKeyB64 = serializePublicKey(keyPair.publicKey);

  const scopeYaml: ScopeYaml = {
    schemaVersion: 1,
    scopeId,
    name: opts.name,
    publicKey: publicKeyB64,
    createdAt: new Date().toISOString(),
    parentScope: opts.parentScope ?? null,
    metadata: opts.metadata ?? {},
  };

  await saveScopeYaml(scopeYamlPath, scopeYaml);
  await writeFile(identityKeyPath, serializePrivateKey(keyPair.privateKey), { mode: 0o600 });
  await chmod(identityKeyPath, 0o600);
  await ensureGitignore(opts.rootDir);

  return { scopeId, scopeYamlPath, identityKeyPath };
}

export async function loadScope(
  rootDir: string,
): Promise<{ scopeYaml: ScopeYaml; keyPair: Ed25519KeyPair }> {
  const orqDir = join(rootDir, ORQENIX_DIR);
  const scopeYaml = await loadScopeYaml(join(orqDir, SCOPE_YAML));
  const pem = await readFile(join(orqDir, IDENTITY_KEY), "utf-8");
  const privateKey = deserializePrivateKey(pem);
  const { derivePublicKey } = await import("./keypair.js");
  const publicKey = await derivePublicKey(privateKey);
  const keyPair: Ed25519KeyPair = { publicKey, privateKey };

  if (!(await verifyKeyPair(keyPair))) throw new KeyPairMismatchError();
  try {
    verifyScopeYamlConsistency(scopeYaml, publicKey);
  } catch (e) {
    if (e instanceof KeyPairMismatchError || e instanceof ScopeYamlCorruptError) throw e;
    throw new ScopeYamlCorruptError((e as Error).message);
  }
  return { scopeYaml, keyPair };
}
