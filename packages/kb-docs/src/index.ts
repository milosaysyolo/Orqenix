export interface Chunk {
  path: string;
  heading: string[];
  text: string;
  startLine: number;
  endLine: number;
}

export function chunkMarkdown(path: string, content: string): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = content.split("\n");
  let currentHeadings: string[] = [];
  let buffer: string[] = [];
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      if (buffer.length > 0) {
        chunks.push({
          path,
          heading: [...currentHeadings],
          text: buffer.join("\n"),
          startLine,
          endLine: i,
        });
        buffer = [];
      }

      const level = headingMatch[1]!.length;
      currentHeadings = currentHeadings.slice(0, level - 1);
      currentHeadings.push(headingMatch[2]!);
      startLine = i + 1;
    } else {
      buffer.push(line);
    }
  }

  if (buffer.length > 0) {
    chunks.push({
      path,
      heading: currentHeadings,
      text: buffer.join("\n"),
      startLine,
      endLine: lines.length,
    });
  }

  return chunks;
}

export interface DocResult {
  id: string;
  path: string;
  heading: string[];
  text: string;
  score: number;
}

export class DocsKB {
  static async open(dbPath: string): Promise<DocsKB> {
    return new DocsKB(dbPath);
  }

  constructor(_dbPath: string) {
    void _dbPath;
  }

  async index(path: string, content: string): Promise<void> {
    chunkMarkdown(path, content);
  }

  async query(_q: string, _topK?: number): Promise<DocResult[]> {
    return [];
  }
}
