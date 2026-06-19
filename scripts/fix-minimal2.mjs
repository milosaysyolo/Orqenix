import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';

const SPDX = "// SPDX-License-Identifier: Apache-2.0";

function isCollapsed(content) {
  return content.split('\n').every(l => l.trim() === '' || l.trim().startsWith('//') || l.trim().startsWith('*'));
}

function splitIntoLines(raw) {
  const lines = [];
  let buf = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i], next = raw[i+1] || '';
    if (ch === '/' && next === '/' && buf.length > 0 && buf[buf.length-1] !== '\n' && buf[buf.length-1] !== '/') {
      lines.push(buf);
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

function fix(file) {
  let content = readFileSync(file, 'utf-8');
  if (!content.startsWith(SPDX) || !isCollapsed(content)) return false;

  const rest = content.slice(SPDX.length);
  const lines = splitIntoLines(rest);

  // Separate header from code
  const codePattern = /\b(import\s+|export\s+|\/\*\*|abstract\s+class|class\s+\w+|function\s+\w+)/;
  let header = [];
  let codeParts = [];
  let inCode = false;

  for (const line of lines) {
    if (inCode) { codeParts.push(line); continue; }

    const trimmed = line.trim();
    if (!trimmed.startsWith('//') && trimmed) {
      codeParts.push(line);
      inCode = true;
      continue;
    }

    const m = line.match(codePattern);
    if (m && m.index > 0) {
      header.push(line.slice(0, m.index).replace(/[^a-zA-Z0-9)\]}\/\n]+$/, ''));
      codeParts.push(line.slice(m.index));
      inCode = true;
      continue;
    }

    header.push(line);
  }

  // Build result: header
  let result = SPDX + '\n';
  for (const h of header) {
    const t = h.trim();
    if (!t || t === '//') result += '//\n';
    else if (t.startsWith('//')) result += t + '\n';
    else result += h + '\n';
  }

  // Build result: code
  if (codeParts.length) {
    let code = codeParts.join('');
    // Strip non-code prefix
    code = code.replace(/^[^a-zA-Z0-9_\/\{\[\(@"']+/, '');

    // Handle inline // comments: find code after comment text
    // Replace `// comment text      codeKeyword...` with `// comment text\ncodeKeyword...`
    code = code.replace(/(\/\/[^\n]*?)\s{4,}(return |const |let |var |if |for |while |switch |try |catch |finally |throw |this\.|await |async |function |class )/g, '$1\n$2');

    // Handle JSDoc + statement on same line: `*/export` -> `*/\nexport`
    code = code.replace(/\*\/(\s*)(export |import |abstract |class |function |const |let |var |type |interface |enum |async )/g, '*/\n$2');

    // Split at ; followed by statement keyword
    code = code.replace(/;(\s*)(export |import |abstract |class |function |const |let |var |type |interface |enum |async |public |private |protected |static |readonly )/g, ';\n$2');

    // Split at } followed by JSDoc or export/import
    code = code.replace(/}\s*(\/\*\*|export\s|import\s)/g, '}\n$1');

    result += '\n' + code;
  }

  writeFileSync(file, result, 'utf-8');
  return true;
}

// Fix files
const files = globSync('packages/*/src/**/*.{ts,tsx}', { nodir: true });
let fixed = 0;
for (const f of files) {
  if (fix(f)) { fixed++; console.log(`Fixed: ${f}`); }
}
console.log(`\nFixed ${fixed} files.`);
