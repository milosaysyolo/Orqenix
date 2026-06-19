import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { globSync } from 'glob';
import { execSync } from 'child_process';

const SPDX = '// SPDX-License-Identifier: Apache-2.0';

function isCollapsed(content) {
  const lines = content.split('\n');
  return lines.every(l => l.trim() === '' || l.trim().startsWith('//') || l.trim().startsWith('*'));
}

function splitLines(raw) {
  // Split at every `//` that follows non-/ content (collapsed line boundaries)
  let lines = [];
  let buf = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i], next = raw[i+1] || '';
    if (ch === '/' && next === '/' && buf.length > 0 && buf[buf.length-1] !== '\n' && buf[buf.length-1] !== '/') {
      lines.push(buf);
      // peek ahead for empty comment (////)
      if (raw[i+2] === '/' && raw[i+3] === '/') {
        lines.push('//');
        buf = '//';
        i += 3;
      } else {
        buf = '//';
        i++;
      }
      continue;
    }
    buf += ch;
  }
  if (buf) lines.push(buf);
  return lines;
}

function extractCodeAfter(line) {
  // Find first code keyword after comment text in a comment+code mixed line
  const codeKw = /\b(import\s+|export\s+|\/\*\*|abstract\s+class|class\s+\w+|function\s+\w+|const\s+\w+\s*[:=]|let\s+\w+|var\s+\w+|type\s+\w+\s*=|interface\s+\w+|enum\s+\w+)/;
  const m = line.match(codeKw);
  if (m && m.index > 0) {
    return { comment: line.slice(0, m.index).replace(/[^a-zA-Z0-9)\]}\/]+$/, ''), code: line.slice(m.index) };
  }
  return null;
}

function fixContent(content, filePath) {
  if (!content.startsWith(SPDX) || !isCollapsed(content)) return content;

  const rest = content.slice(SPDX.length);

  // Step 1: Split rest into logical lines at // boundaries
  const rawLines = splitLines(rest);

  // Step 2: Separate header from code
  let headerLines = [];
  let codeContent = '';
  let foundCode = false;

  for (const line of rawLines) {
    if (foundCode) {
      codeContent += line;
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed === '') {
      // This is a header comment line — check if code is appended
      const split = extractCodeAfter(line);
      if (split) {
        headerLines.push(split.comment);
        codeContent = split.code;
        foundCode = true;
      } else {
        headerLines.push(line);
      }
    } else {
      // This line doesn't start with // — it's pure code
      codeContent = line;
      foundCode = true;
    }
  }

  // Step 3: Build result with header comments
  let result = SPDX + '\n';
  for (const h of headerLines) {
    const t = h.trim();
    if (t === '' || t === '//') {
      result += '//\n';
    } else if (t.startsWith('//')) {
      result += t + '\n';
    } else {
      result += h + '\n';
    }
  }

  // Step 4: Handle code section
  if (codeContent.trim()) {
    // Insert newlines at statement boundaries in code
    let code = codeContent;

    // Split after closing braces when followed by more code
    code = code.replace(/}([^}]+?)(export|import|abstract|class|function|const|let|var|type|interface|enum|async|public|private|protected|static|readonly)/g, '}\n$2');
    
    // Split JSDoc from following export/class/function
    code = code.replace(/\*\/(\s*)(export|import|abstract|class|function|const|let|var|type|interface|enum|async)/g, '*/\n$2');

    // Handle inline // comments: split after comment text, extract code after
    // Pattern: `// comment text      codeKeyword...`
    code = code.replace(/^(\/\/[^\n]*?)(\s{3,})([a-zA-Z_])/gm, '$1\n$3');

    // Split at ; followed by statement keyword
    code = code.replace(/;(\s*)(export|import|abstract|class|function|const|let|var|type|interface|enum|async|public|private|protected|static)/g, ';\n$2');

    // Try prettier
    const tmpFile = (filePath || '.tmp') + '.fix.ts';
    try {
      writeFileSync(tmpFile, code, 'utf-8');
      try {
        execSync(`npx prettier --write "${tmpFile}"`, { stdio: 'pipe', timeout: 30000 });
      } catch {}
      const formatted = readFileSync(tmpFile, 'utf-8');
      result += '\n' + formatted.replace(/\n{4,}/g, '\n\n\n');
    } finally {
      try { unlinkSync(tmpFile); } catch {}
    }
  }

  return result;
}

// Fix all files
const files = globSync('packages/*/src/**/*.{ts,tsx}', { nodir: true });
let fixed = 0;

for (const f of files) {
  let content;
  try {
    content = execSync(`git show HEAD:"${f.replace(/\\/g, '/')}"`, { encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    content = readFileSync(f, 'utf-8');
  }

  if (!content.startsWith(SPDX) || !isCollapsed(content)) continue;

  const fixedContent = fixContent(content, f.replace(/\\/g, '/'));
  if (fixedContent !== content) {
    writeFileSync(f, fixedContent, 'utf-8');
    fixed++;
    console.log(`Fixed: ${f}`);
  }
}

console.log(`\nFixed ${fixed} files.`);
