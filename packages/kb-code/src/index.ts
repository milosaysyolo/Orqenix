export const LANGS = [
  "typescript",
  "javascript",
  "tsx",
  "python",
  "rust",
  "go",
  "java",
  "kotlin",
  "ruby",
  "php",
  "csharp",
  "cpp",
  "c",
  "swift",
  "scala",
  "elixir",
  "html",
  "css",
  "json",
  "yaml",
] as const;

export function startWatcher(root: string, onChange: (path: string) => void) {
  return {
    close() {},
    root,
    onChange,
  };
}

export interface CodeResult {
  id: string;
  path: string;
  kind: string;
  name: string;
  score: number;
}

export class CodeKB {
  static async open(dbPath: string): Promise<CodeKB> {
    return new CodeKB(dbPath);
  }

  constructor(_dbPath: string) {
    void _dbPath;
  }

  async index(_path: string, _content: string): Promise<void> {
    return;
  }

  async query(_q: string, _topK?: number): Promise<CodeResult[]> {
    return [];
  }
}
