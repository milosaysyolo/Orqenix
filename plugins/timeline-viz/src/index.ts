// SPDX-License-Identifier: Apache-2.0
// Reference visualization plugin: renders memory entries as an SVG timeline.

interface TimelineEntry {
  id: string;
  timestamp: string;
  label: string;
}

interface TimelineInput {
  entries: TimelineEntry[];
}

interface TimelineOutput {
  svg: string;
}

export async function invoke(input: TimelineInput): Promise<TimelineOutput> {
  const sorted = [...input.entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const width = 800;
  const height = 60 + sorted.length * 24;
  const dots = sorted
    .map((e, i) => {
      const y = 40 + i * 24;
      return (
        `<circle cx="40" cy="${y}" r="4" fill="oklch(0.56 0.20 154)" />` +
        `<text x="56" y="${y + 4}" font-size="12" fill="currentColor">${escapeXml(e.label)}</text>`
      );
    })
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<line x1="40" y1="40" x2="40" y2="${height - 20}" stroke="currentColor" stroke-opacity="0.2" />
${dots}
</svg>`;

  return { svg };
}

function escapeXml(s: string): string {
  return s.replace(
    /[<>&'\""]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c,
  );
}
