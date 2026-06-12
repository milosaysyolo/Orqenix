// SPDX-License-Identifier: Apache-2.0
// Reference knowledge-source plugin: Notion connector.
//
// Demonstrates the knowledge-source plugin kind: fetch external knowledge,
// normalize, and surface as Orqenix knowledge entries.

interface NotionFetchInput {
  query: string;
}

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  url: string;
}

interface NotionFetchOutput {
  entries: KnowledgeEntry[];
}

/**
 * Plugin entry point. Invoked by the Orqenix plugin sandbox over IPC.
 * Reads NOTION_TOKEN + database_id from settings, queries the Notion API.
 */
export async function invoke(input: NotionFetchInput): Promise<NotionFetchOutput> {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.ORQENIX_PLUGIN_NOTION_DATABASE_ID;

  if (!token || !databaseId) {
    return { entries: [] };
  }

  const resp = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'notion-version': '2022-06-28',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      filter: {
        property: 'title',
        rich_text: { contains: input.query },
      },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) return { entries: [] };

  const data = (await resp.json()) as {
    results?: Array<{ id: string; url: string; properties: Record<string, unknown> }>;
  };

  const entries: KnowledgeEntry[] = (data.results ?? []).map((page) => ({
    id: page.id,
    title: extractTitle(page.properties),
    content: extractContent(page.properties),
    url: page.url,
  }));

  return { entries };
}

function extractTitle(props: Record<string, unknown>): string {
  const titleProp = props.title as { title?: Array<{ plain_text?: string }> } | undefined;
  return titleProp?.title?.[0]?.plain_text ?? 'Untitled';
}

function extractContent(props: Record<string, unknown>): string {
  return JSON.stringify(props).slice(0, 500);
}
