// SPDX-License-Identifier: Apache-2.0
// @bc CS-027 CLI Parser
// @gate G25

export interface ParsedArgs {
  command: string[];
  flags: Record<string, string | boolean>;
  positionals: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const command: string[] = [];
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  let i = 0;
  // Collect leading non-flag tokens as the command path until we hit a flag or a known positional pattern
  while (i < argv.length && !argv[i]!.startsWith('-')) {
    command.push(argv[i]!);
    i++;
  }

  for (; i < argv.length; i++) {
    const tok = argv[i]!;
    if (tok.startsWith('--')) {
      const eq = tok.indexOf('=');
      if (eq > -1) {
        flags[tok.slice(2, eq)] = tok.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith('-')) { flags[tok.slice(2)] = next; i++; }
        else flags[tok.slice(2)] = true;
      }
    } else if (tok.startsWith('-') && tok.length === 2) {
      flags[tok.slice(1)] = true;
    } else {
      positionals.push(tok);
    }
  }
  return { command, flags, positionals };
}

export function flagString(args: ParsedArgs, name: string, def?: string): string | undefined {
  const v = args.flags[name];
  if (typeof v === 'string') return v;
  return def;
}

export function flagBool(args: ParsedArgs, name: string, def = false): boolean {
  const v = args.flags[name];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return def;
}
